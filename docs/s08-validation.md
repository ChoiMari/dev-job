# S08 검증·통합 기록 (2026-10-06)

## 작업 위치와 경계

- 작업 위치: `C:/Users/user/.codex/worktrees/f7b6/dev-job` (detached HEAD).
- 시작 시 main `D:/workspace/dev-job`과 S08 worktree는 모두 clean, HEAD `fab6792aa41f91bfaa93fbc89c93787e4294b9f9`였다. S02-V·S03·S07이 포함된 상태를 기준으로 작업했다.
- 저장 공고 조회만 구현했다. 새 기술·제품 의존성·외부 호출·스키마·migration은 추가하지 않았다. 기존 개발 DB 초기화, 다른 worktree 수정, commit/push/main 통합/worktree 삭제는 하지 않았다.

## 변경 파일

| 영역 | 변경 파일 (저장소 상대 경로) |
| --- | --- |
| Backend API | `backend/src/main/java/com/devjob/job/controller/JobController.java` |
| Backend DTO | `backend/src/main/java/com/devjob/job/dto/JobQuery.java`, `JobPage.java`, `JobSummary.java`, `JobDetail.java` |
| Backend 조회 | `backend/src/main/java/com/devjob/job/service/JobQueryService.java`, `backend/src/main/java/com/devjob/job/repository/JobPostingRepository.java` |
| Backend 검증 | `backend/src/test/java/com/devjob/job/JobQueryDatabaseTest.java`, `backend/src/test/resources/fixtures/s08-browser.sql` |
| Frontend API | `frontend/src/api/jobs.ts` |
| Frontend 화면·스타일 | `frontend/src/pages/jobs/JobsPage.tsx`, `frontend/src/pages/jobs/jobs.css` |
| 공유 라우팅·메뉴 | `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx` |
| Frontend 검증 | `frontend/tests/jobs.test.mjs`, `frontend/tests/jobs-flow.mjs` |
| 문서 | `docs/api-spec.md`, `docs/requirements.md`, `docs/user-flow.md`, `docs/ui-spec.md`, `docs/architecture.md`, `docs/implementation-roadmap.md`, `docs/portfolio-log.md`, 이 문서 |

## 실행 결과

- Backend `gradlew.bat build dbTest --offline --no-daemon`: 성공. 일반 테스트 45개, DB 테스트 16개 통과(S08 7개·기존 인증/연결/User 회귀 9개). `JobCollectionDatabaseTest` 8개는 `DB_NAME=devjob_s07_test` 전용 조건으로 skip했다.
- DB는 별도 컨테이너 `devjob-s08-f7b6-test`, PostgreSQL 17, `127.0.0.1:38418/devjob_s08_test`를 사용했다. 기존 V1·V2 적용과 JPA validate가 통과했다. S08 테스트는 실제 DB 이름을 확인한 뒤 트랜잭션 rollback으로 격리한다.
- Frontend `pnpm build`, `pnpm test`: 성공, 테스트 23개(기존 19개·공고 API 4개).
- `jobs-flow.mjs`: 실제 Backend `127.0.0.1:8088`과 Vite proxy `127.0.0.1:5177`에서 Edge headless로 성공. 회원가입/로그인·20+3 페이지·검색/복합 필터·목록/상세/복귀/새로고침·원문 텍스트·빈 결과/범위 밖 페이지/404/잘못된 주소·로딩·목록/상세 500 재시도·로그아웃 보호를 확인했다. 오류 응답만 브라우저 route로 주입하고 정상 데이터 조회·인증·404는 실제 Backend를 사용했다.
- 화면 캡처: `frontend/.cache/s08/detail-desktop.png`, `list-mobile.png`, `detail-mobile.png` (gitignore 대상). 1440×1000·390×844에서 배치를 확인했고 모바일 목록/상세 가로 넘침과 pageerror가 없었다.
- fixture를 비어 있지 않은 S08 검증 DB에 다시 적용하자 사전 검사로 중단했고 공고 23건이 유지됐다. 최종 diff whitespace 검사·문서 상대 링크·검증 스크립트 구문 검사도 통과했다.
- 오프라인 설치 캐시에 일부 패키지가 없어 기존 main의 node_modules를 읽어 이 worktree에 복사하고 의존성 링크를 이 worktree 내부 경로로 복원했다. main은 수정하지 않았다. Gradle 캐시도 worktree의 무시된 `.gradle-user-home`으로 복사해 사용했다. 복사 중 React 중복 인스턴스가 발생해 링크를 복원한 후 빌드·브라우저 검증을 다시 통과했다. 저장소 lockfile·의존성 버전은 변경하지 않았다.
- 미실행: 실제 Work24·AI 호출, 배포 HTTPS, 실물 모바일, 다른 브라우저, S07 전용 DB 테스트 재실행.
- 검증 종료 후 이 작업이 실행한 Backend·Vite·S08 DB 컨테이너를 정지했다. 컨테이너 데이터와 worktree는 보존했다. 최종 확인에서도 main은 clean이었다.

## 재현

1. **새로운 격리 PostgreSQL**을 준비하고 `DB_HOST`, `DB_PORT`, `DB_NAME=devjob_s08_test`, `DB_USERNAME`, `DB_PASSWORD`를 해당 DB 값으로 설정한다. 기존 개발 DB를 지정하지 않는다. `GRADLE_USER_HOME`은 접근 가능한 로컬 캐시를 사용한다.
2. `backend`에서 `gradlew.bat build dbTest`를 실행한다. 오프라인 캐시가 완비되어 있으면 `--offline --no-daemon`을 추가할 수 있다. S08 테스트를 seeded DB에서 다시 실행하려면 새 격리 DB를 준비한다.
3. DB 테스트 후 빈 공고 DB에 `backend/src/test/resources/fixtures/s08-browser.sql`을 psql의 `ON_ERROR_STOP=1`로 적용한다. 이 fixture는 S08 DB 이름·빈 공고 테이블을 검사하고 실패하면 중단한다. 기존 데이터를 비우지 않는다.
4. 같은 DB에서 Backend를 `SERVER_PORT=8088`, 로컬 HTTP 전용 `SESSION_COOKIE_SECURE=false`로 실행한다. `frontend`에서 `VITE_API_PROXY_TARGET=http://127.0.0.1:8088`을 설정하고 `pnpm dev --port 5177 --strictPort`로 실행한다.
5. `frontend`에서 `pnpm build`, `pnpm test`를 실행한다. 기존 Playwright가 있는 환경에서는 `PLAYWRIGHT_MODULE`에 설치된 모듈 경로를 지정하고 `S08_FRONTEND_URL=http://127.0.0.1:5177`로 `node tests/jobs-flow.mjs`를 실행한다. 이 스크립트는 전용 23건 fixture와 Edge가 필요하며 개발용 검증 계정을 만든다. Playwright를 프로젝트 의존성으로 추가하지 않았다.

## 통합 시 주의사항

통합 메모: main에서는 S04 프로필·S05 기술의 `#/profile` 경로와 S08 `#/jobs`·상세 경로를 함께 유지했다. 이 문서의 시작 상태와 개별 검증 수치는 S08 worktree 작업 당시의 기록이다. main 통합 검증 결과는 별도로 보고한다.

- S04·S05와 `App.tsx`, `Layout.tsx`, API/UI/요구사항/사용자 흐름/로드맵/portfolio 문서가 겹칠 수 있다. 경로·제목·메뉴 추가를 수동으로 합치고 기존 인증 경계를 보존한다. main 통합 완료 상태는 실제 통합 후 별도로 갱신한다.
- `frontend/src/styles.css`, 공통 상태 컴포넌트, 인증·API 클라이언트, SecurityConfig는 변경하지 않았다. 공고 전용 CSS는 기존 토큰을 재사용한다.
- `JobPostingRepository`에 `JpaSpecificationExecutor`를 추가했다. S09 등 다른 작업의 Repository 변경이 있다면 기존 수집 조회 메서드와 함께 유지한다.
- 새 migration이 없어 이번 작업의 migration 버전 충돌은 없다. S04·S05의 migration 순서와 기존 V1/V2 이력은 해당 작업 통합 시 별도로 확인하며 DB 이력을 자동 수정하거나 초기화하지 않는다.
- S10은 bookmark 예약 필드·카드/상세 버튼, S11은 사용자별 지원 상태·필터, S12는 분석·기술 결과, S13은 기술/적합도 필터·정렬을 연결한다. S08 예약값을 실제 사용자 상태로 오해하지 않도록 현재 UI에는 표시하지 않는다.
