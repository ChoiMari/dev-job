# S10 북마크 구현·검증 (2026-10-06)

통합 메모: 아래 V5 이력은 S10 단독 worktree 검증 당시의 기록이다. main에서는 S06 프로젝트 V5 다음에 북마크 migration을 `V6__create_bookmarks.sql`로 배치했다. 기존 검증 DB 이력은 수정하지 않았다.

## 범위와 변경 파일

- 현재 `8041/dev-job` worktree에 S10을 구현했다. 시작 시 작업 트리는 clean이었다. main 통합·커밋·push는 수행하지 않았다.
- Backend: `bookmark/{controller,service,repository,entity,dto}`, `V5__create_bookmarks.sql`을 추가하고 `JobController`, `JobQueryService`, `JobSummary`, `JobDetail`에 현재 사용자의 저장 상태를 연결했다. Controller → Service → Repository 경계와 기존 세션/CSRF를 사용한다. 외부 Adapter·AI·지원 API·새 제품 의존성은 추가하지 않았다.
- Frontend: `api/bookmarks.ts`, `BookmarkButton.tsx`, `pages/jobs/BookmarksPage.tsx`를 추가했다. `JobsPage.tsx`, 공고 CSS, `App.tsx`, `Layout.tsx`, 공고 응답 validator를 연결했다. 카드/상세 저장·해제, 관심 목록·페이지 이동·상세 복귀, 빈 화면·처리 중·오류/재시도를 제공한다.
- 테스트: `BookmarkSecurityTest`, `BookmarkDatabaseTest`, `BookmarkConcurrencyDatabaseTest`, `s10-browser.sql`, `bookmarks.test.mjs`, `bookmarks-flow.mjs`를 추가했다. 기존 `JobQueryDatabaseTest`는 실제 `CurrentUser` 인증 주체와 S10 격리 DB에서도 동작하도록 갱신했다.
- 문서: `api-spec.md`, `erd.md`, `requirements.md`, `user-flow.md`, `ui-spec.md`, `implementation-roadmap.md`, `architecture.md`, `portfolio-log.md`, migration README와 이 기록을 동기화했다. architecture의 CRM 미구현 설명은 S09 당시 상태로 명확히 했다.

## 자동 검증

- Backend `gradlew.bat build dbTest --offline --no-daemon` 통과. 일반 테스트 **83개**(S10 보안/입력 2개 포함), 실제 DB 실행 **23개**가 통과했다. DB는 S10 7개·S08 7개·기존 인증/HTTP/연결/User 9개다. 다른 DB 이름을 요구하는 S04·S05·S07·Work24 19개는 skip했으며 재검증 완료로 간주하지 않는다. 최종 import 정리 후 build와 S10 DB 7개도 다시 통과했다.
- 새 컨테이너 `devjob-s10-8041-test`, PostgreSQL 17, tmpfs, loopback 임의 포트 `40734`, `devjob_s10_test`에서 Flyway V1~V5·JPA `validate`를 확인했다. 기존 개발 DB·V1~V4·기존 테이블은 변경하지 않았다. S10 일반 DB 테스트는 rollback하고, 동시 테스트는 자신이 생성한 행만 정리한다.
- 보안: 익명 401, 인증된 mutation의 CSRF 누락 403, jobId 누락/null/0/음수/문자열/소수/boolean/Long 범위 초과의 400을 확인했다.
- 실제 DB: 저장 201·중복 409·삭제 204·재삭제 404, 목록/공고 저장 상태의 사용자 분리, 타인 삭제 404와 원래 관계 보존, 입력 userId/header 무시, 다른 사용자 독립 저장, 공고 보존, 페이지 건수·동률 ID 정렬·빈 페이지, 마감/날짜 없는 공고 유지, 없는 공고·잘못된 페이지/ID, FK·직접 UNIQUE 위반을 확인했다.
- 동시 요청: 같은 사용자·공고 두 저장에서 **201 하나·409 하나·DB 관계 1행**을 확인했다. UNIQUE와 PostgreSQL `ON CONFLICT`로 사전 조회 경쟁을 피하고 중복을 500으로 처리하지 않는다.
- Frontend `pnpm test` **33개**·`pnpm build` 통과. S10 4개는 jobId·쿠키·최신 CSRF, malformed 응답/페이지/시각·중복 결과 거부, 오류 전파와 mutation 자동 재시도 없음, 잘못된 입력 무호출·AbortSignal 전달을 검증했다.

## 실제 브라우저

- 설치된 Playwright·Edge Chromium, 실제 Backend `127.0.0.1:8081`·Vite proxy `127.0.0.1:5181`·격리 DB에서 `frontend/tests/bookmarks-flow.mjs`가 통과했다. `s10-browser.sql`은 DB 이름·빈 공고/회사 테이블을 확인한 뒤 23개 모의 공고만 추가한다.
- 가입/로그인·쿠키 세션, 빈 목록, 카드 저장·처리 중 비활성화와 POST 1회, 상세/새로고침 유지·해제·재저장, 다른 탭에서 먼저 변경한 실제 409/404 후 상태 재조회, 20+3 목록 페이지·상세 복귀, 마지막 페이지 마지막 해제 후 이전 페이지 이동, 범위 밖 페이지 복귀, 마지막 관심 공고 해제 후 빈 목록을 확인했다.
- 저장 실패 503·목록 실패 500은 브라우저 route로 주입하고 기존 상태 유지·재시도를 확인했다. 정상 조회·mutation·충돌·소유권은 실제 API를 사용했다. 다른 계정의 빈 화면·bookmarked=false·타인 삭제 404와 원래 관계 보존, 로그아웃 후 접근 차단을 확인했다.
- 지연된 상세 mutation 도중 다른 공고로 이동해도 새 공고 상태가 바뀌지 않도록 적용 대상 ID를 검사하고 브라우저로 회귀 확인했다.
- Desktop 1440×1000·768/390/320px 너비의 목록/상세를 확인했다. 검사한 관심 목록에 가로 넘침·44px 미만의 표시된 버튼·JavaScript pageerror가 없었다. 원문 script는 텍스트로 표시되고 실행되지 않았다.
- `frontend/.cache/s10/bookmarks-desktop.png`, `bookmarks-mobile.png`, `detail-mobile.png`를 직접 검토했다. 저장 해제 hover의 공통 pressed 스타일 충돌을 공고 전용 CSS에서 수정하고 실제 computed 색상도 확인했다. 캡처·캐시·빌드 산출물은 기존 gitignore 대상이다.
- 기존 main의 캐시/의존성을 읽어 이 worktree에 복사하고 의존성 링크를 내부 경로로 복원했다. main 파일·lockfile·의존성 버전은 변경하지 않았다. Gradle 캐시 읽기·Docker/Edge 실행은 sandbox 밖 로컬 검증 권한을 사용했다.
- 미실행: 배포 HTTPS·실물 모바일·다른 브라우저·실제 Work24/LLM 호출·main 통합. S10은 해당 외부 호출을 필요로 하지 않는다.
- 마무리: 작업에서 실행한 Backend·Vite 세션과 S10 DB 컨테이너를 정지했다. DB는 tmpfs이므로 재현 시 새 DB와 fixture를 준비한다. 최종 diff whitespace·변경 문서 상대 링크·검증 스크립트 구문·산출물 gitignore 검사가 통과했다.

## 재현

1. **새로운 격리 PostgreSQL**에 `DB_NAME=devjob_s10_test`와 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`를 설정한다. 기존 개발 DB나 S05의 과거 V3 기술 DB를 사용하지 않는다.
2. `backend`에서 `gradlew.bat build dbTest`를 실행한다. 캐시가 충분하면 `--offline --no-daemon`을 사용할 수 있다. S08 테스트도 S10 DB 이름을 허용하고 rollback으로 격리한다.
3. 테스트 후 빈 공고/회사 테이블에 `backend/src/test/resources/fixtures/s10-browser.sql`을 `psql -v ON_ERROR_STOP=1`로 적용한다. 이미 fixture가 있으면 실패하며 기존 데이터를 비우지 않는다.
4. Backend를 `SERVER_PORT=8081`, 로컬 HTTP 전용 `SESSION_COOKIE_SECURE=false`로 실행한다. Frontend에 `VITE_API_PROXY_TARGET=http://127.0.0.1:8081`을 설정하고 `pnpm dev --port 5181 --strictPort`를 실행한다.
5. 설치된 Playwright 경로를 `PLAYWRIGHT_MODULE`에, Frontend URL을 `S10_FRONTEND_URL`에 설정하고 `frontend`에서 `node tests/bookmarks-flow.mjs`, `pnpm test`, `pnpm build`를 실행한다. 흐름 검증은 고유한 검증 계정을 생성한다. 제품 의존성을 추가하지 않는다.
