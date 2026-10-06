# S11 지원·상태 이력 구현 및 검증 (2026-10-06)

통합 메모: 아래 V5 검증은 S11 단독 worktree 당시 기록이다. main에서는 프로젝트 V5·북마크 V6 다음에 지원 migration을 `V7__create_applications.sql`로 배치했다. 기존 DB 이력은 수정하지 않았다.

## 구현 범위

- 세션 사용자별 지원 등록·페이지 목록·상세·메모/일정 PATCH·상태 변경·이력 API 6개.
- 초기 상태는 INTERESTED·PLANNED·APPLIED이며 최초 등록도 이력으로 저장한다. 문서의 정상·철회·탈락 전이만 허용하고 동일 상태·건너뛰기·역행·종료 상태 전이는 409로 거부한다.
- APPLIED 생성·전이에는 실제 지원일을 입력한다. 이후 상태에서도 지원일을 유지한다. 메모·일정은 선택이며 PATCH 누락/명시적 null을 구분한다.
- 공고 목록·상세의 실제 사용자별 applicationStatus와 공고 상태 필터.
- 공고 상세의 등록 폼, 지원 관리 Kanban, 상세 편집·이력, 상태 필터·페이지 복귀, 오류·재시도·빈 상태·처리 중·성공 표시.
- 새로운 외부 서비스·라이브러리, 북마크·지원 삭제·AI 호출은 추가하지 않았다. 커밋·push·main 통합과 기존 개발 DB migration은 수행하지 않았다.

## 저장·동시성 경계

[당시 V5 migration의 통합본 V7](../backend/src/main/resources/db/migration/V7__create_applications.sql)은 application과 application_status_history만 추가한다. 기존 V1~V4 SQL·이력을 변경하지 않는다. UNIQUE(user_id, job_posting_id), FK, 상태·지원일 CHECK와 목록·이력 인덱스를 사용한다.

[ApplicationService](../backend/src/main/java/com/devjob/application/service/ApplicationService.java)는 현재 상태와 이력 추가를 동일 트랜잭션으로 처리한다. 메모/일정 수정과 상태 변경 모두 지원 행에 PESSIMISTIC_WRITE 잠금을 사용해 최신 데이터를 기반으로 검증·수정한다. 생성 중복은 사전 조회와 DB UNIQUE로 보호한다. 공고 목록은 사용자·상태 EXISTS 필터와 페이지 ID별 지원 상태 일괄 조회를 사용한다. 외부 수집·AI가 CRM 요청에 개입하지 않는다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| Backend build, 일반 테스트 | 85개 통과, 실패·오류 없음 |
| PostgreSQL dbTest | 25개 실행·통과, 다른 단계 DB 이름 가드로 19개 skip |
| S11 DB 테스트 | API 6개 + 동시성/롤백 3개 통과 |
| S08 회귀 | 기존 검색·페이지·기본 필터·원문·오류·인증 7개 통과 |
| 기타 DB 회귀 | 연결 2개·인증 저장 4개·실제 인증 HTTP 1개·User Repository 2개 통과 |
| Frontend build / Node 테스트 | 빌드 성공, 34개 통과 |
| 실제 브라우저 | Edge Chromium, 실제 Backend·세션 쿠키·CSRF·PostgreSQL 연동 통과 |

DB는 새 PostgreSQL 17.11 컨테이너 devjob-s11-test의 tmpfs 데이터 영역과 devjob_s11_test만 사용했다. 빈 DB의 Flyway V1~V5 적용과 JPA validate를 확인했다. S11·S08의 API DB 테스트는 트랜잭션 rollback을 사용한다. 동시성 테스트는 UUID 사용자/공고 fixture를 생성하고 자신이 생성한 행만 정리한다. 기존 개발 DB·S06 컨테이너에는 접근하지 않았다.

실제 DB 근거:

- 동일 사용자·공고 동시 등록: 성공 201 하나·충돌 409 하나, 지원 1행·초기 이력 1행.
- 동일 지원 동시 철회: 성공 200 하나·충돌 409 하나, 현재 WITHDRAWN·이력 총 2행.
- 생성·전이 뒤 강제 트랜잭션 rollback: 지원/초기 이력이 함께 없어지고, 기존 상태/이력은 함께 보존된다.
- 최초 이력·정상 전이 전체·종료/중복/건너뛰기 거부, 날짜·입력·CSRF, 타인 상세/수정/전이/이력 403, 목록·공고 상태 분리와 복합 필터를 확인했다.

브라우저 근거:

- 신규 계정 → 빈 지원 목록 → 공고에서 지원 예정 등록 → 새로고침 → 상세 메모·일정 저장 → 지원 완료/서류 통과/면접/최종 합격 → 시간순 이력.
- 한국 시간대 일정 입력 14:00 → UTC 저장 → 화면 14:00 재표시, 실제 지원일 유지.
- 별도 사용자 세션의 타인 지원 접근 403, 같은 공고의 독립 APPLIED 직접 등록·지원일 입력·내 목록 1건.
- 24건의 지원 목록 20+4 페이지 이동·새로고침, 상태 필터·빈 결과·상세 복귀, 공고 지원 상태/필터.
- 로딩, 없는 지원, 잘못된 ID, 저장 실패 시 초안 유지·재저장, 이력 실패 시 본문 유지·재시도, 로그아웃 후 보호 경로.
- 저장·이력 실패는 브라우저 응답 500 주입으로 확인했다. 이는 실제 DB 장애를 유발한 검증은 아니다.
- 1440·768·390·320px에서 목록·상세·공고의 가로 넘침과 44px 미만 표시된 버튼·입력·선택 상자가 없었다. 320px 신규 APPLIED 등록 폼도 넘침 없이 저장했다. Desktop Kanban·320px 상세/등록 캡처를 시각 검토했다.
- 메모의 script 문자열은 텍스트로 표시되고 실행되지 않았으며 JavaScript pageerror가 없었다. 저장된 textarea 기본값이 라벨 이름에 섞여 정확한 이름으로 찾을 수 없던 문제를 명시적 label 연결로 수정하고 재검증했다.

## 변경 파일

- Backend 신규: [application 계층](../backend/src/main/java/com/devjob/application/service/ApplicationService.java), Entity·Repository·입력/응답 DTO·Controller, V5 migration.
- Backend 연결: JobController, JobQueryService, JobQuery, JobSummary, JobDetail.
- 검증: [S11 DB](../backend/src/test/java/com/devjob/application/ApplicationDatabaseTest.java), [동시성/롤백](../backend/src/test/java/com/devjob/application/ApplicationConcurrencyDatabaseTest.java), [보안/입력](../backend/src/test/java/com/devjob/application/ApplicationSecurityTest.java), [전이 그래프](../backend/src/test/java/com/devjob/application/ApplicationStatusTest.java), S08 JobQueryDatabaseTest의 실제 CurrentUser 주체와 S11 DB 실행 가드.
- Frontend: [지원 화면](../frontend/src/pages/applications/ApplicationsPage.tsx)·CSS, ApplicationRegistration·ApplicationStatusBadge, applications API·상태/일정 도우미, jobs API·JobsPage, App·Layout.
- Frontend 검증: [API 테스트](../frontend/tests/applications.test.mjs), [브라우저 흐름](../frontend/tests/applications-flow.mjs), [모의 공고 SQL](../backend/src/test/resources/fixtures/s11-browser.sql).
- 문서: api-spec·erd·architecture·requirements·user-flow·ui-spec·implementation-roadmap·portfolio-log·이 보고서, Backend/Frontend README, migration README.

## 재현

1. 별도의 새 PostgreSQL 17 컨테이너를 만들고 DB_NAME=devjob_s11_test와 해당 DB_HOST·DB_PORT·DB_USERNAME·DB_PASSWORD를 Backend 프로세스에 주입한다. 기존 DB의 이름을 바꾸거나 데이터를 초기화하지 않는다.
2. Backend에서 gradlew.bat build dbTest --offline --no-daemon을 실행한다. 환경의 Gradle 캐시 경로가 필요하면 GRADLE_USER_HOME을 기존 캐시에 지정한다.
3. [s11-browser.sql](../backend/src/test/resources/fixtures/s11-browser.sql)을 해당 일회용 DB에만 적용한다. DB 이름과 기존 fixture 존재를 검사하며 재적용·삭제를 자동 수행하지 않는다.
4. Backend를 SESSION_COOKIE_SECURE=false, 별도의 SERVER_PORT로 로컬 HTTP에서 실행한다. Frontend에서 pnpm install --frozen-lockfile, pnpm build, pnpm test를 실행하고 VITE_API_PROXY_TARGET을 이 서버로 지정해 pnpm preview를 실행한다.
5. 실제 출력된 Frontend 주소를 S11_FRONTEND_URL, 설치되어 있는 Playwright 경로를 PLAYWRIGHT_MODULE로 지정하고 Frontend에서 node tests/applications-flow.mjs를 실행한다. Edge Chromium이 필요하다. 프로덕션 의존성은 추가하지 않는다.

브라우저 실행마다 별도의 테스트 계정을 생성하며 결과 캡처는 Git 제외 frontend/.cache/s11에 저장한다. 검증용 서버와 이번 일회용 DB 컨테이너는 완료 후 중지한다. tmpfs의 테스트 데이터는 중지 시 사라진다.

## 미실행 범위

실물 모바일·다른 브라우저·배포 HTTPS, 실제 Work24/사람인/LLM 호출, S04·S05·S07·S09 전용 DB 테스트는 이번에 재실행하지 않았다. S11은 이미 저장된 공고만 사용하며 외부 지원 제출·북마크·AI·지원 삭제를 구현하거나 검증했다고 해석하지 않는다.
