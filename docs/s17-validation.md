# S17 · MVP 통합·배포 전 검증 (2026-10-07)

## 기준과 격리

- 시작 전 `main`과 이 worktree는 같은 `297ecfd`였고 양쪽 모두 staged/unstaged diff와 미추적 파일이 없었다. S09와 S16은 통합 커밋·로드맵·단계별 검증 기록에서 확인했다.
- PostgreSQL 17.11 일회용 tmpfs 컨테이너를 loopback 임의 포트에 시작했다. 기존 개발 DB·Compose 프로젝트·볼륨과 Flyway 이력은 사용하거나 변경하지 않았다. `devjob_s04_test`~`devjob_s16_test`의 12개 단계별 DB와 `devjob_s17_test`를 새로 만들었다.
- 각 DB의 `flyway_schema_history`에서 V1~V8 8건의 성공과 JPA `validate` 기동을 확인했다. S17 DB에는 [합성 fixture](../backend/src/test/resources/fixtures/s17-integration.sql)만 입력했다. 저장 공고 7건 중 6건은 검증된 형식의 완료 분석·기술 관계를 합성했고, 1건은 분석 전 상태로 남겼다. 실제 제공기관 응답을 저장한 근거는 아니다.

## 실행 결과

| 검증 | 결과 | 범위 |
| --- | --- | --- |
| Backend `gradlew.bat build --offline --no-daemon` | 통과 | 일반 테스트 97건, 컴파일·패키징 |
| Frontend `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test` | 통과 | 잠금 파일 설치, TypeScript·Vite 빌드, 테스트 53건 |
| Backend `gradlew.bat dbTest --offline` | 통과 | 12개 단계별 새 DB에서 각각 실제 실행, 실패 0건. DB 이름 가드로 다른 단계 테스트는 건너뜀 |
| `node tests/s17-http-flow.mjs` | 통과 | 실제 Backend·PostgreSQL HTTP 통합 흐름 |
| `node tests/s17-browser-flow.mjs` | 통과 | Edge Chromium 390px, 실제 Backend의 9개 화면·새로고침·가로 넘침·JS 오류·중복 key 경고 없음 |
| 기존 `dashboard-flow.mjs`, `analytics-flow.mjs`, `skill-gap-flow.mjs` | 통과 | 모의 응답으로 빈/데이터/오류·재시도 화면 회귀 |
| `docker compose -p devjob-s17-check -f compose.yml up -d --wait postgres` | 통과 | 독립 프로젝트의 PostgreSQL healthy 확인 후 컨테이너·테스트 볼륨 제거 |

첫 DB 테스트에서 `OPENAI_API_KEY`를 빈 문자열로 주입했을 때 Spring AI 초기화가 실패했다. 변수를 설정하지 않으면 Backend가 기동하고 키 없는 분석 요청은 `FAILED`가 됐으며 공고·CRM 조회는 계속됐다. `.env.example`과 Backend README에서 키를 쓰지 않을 때 변수를 **설정하지 않도록** 수정했다. 또 DB 이름을 바꾼 뒤 Gradle이 `dbTest`를 `UP-TO-DATE`로 생략하는 문제를 발견해 매 호출 실행하도록 수정하고 12개 DB에서 다시 확인했다. 브라우저 종료 로그에서 프로필의 두 형제 컴포넌트가 같은 사용자 ID key를 사용한 경고도 확인해 각각 다른 key로 고쳤고 콘솔 경고 검사에 추가했다. 초기 실패와 생략된 실행은 통과 건수에 포함하지 않았다.

## 핵심 흐름

| 흐름·계약 | 상태 | 이번 검증의 근거 |
| --- | --- | --- |
| 가입·로그인·로그아웃, 세션·CSRF | 통과 | 실제 HTTP 등록→로그인→`/me`→로그아웃 후 401, CSRF 없는 변경 403, 브라우저 보호 경로 이동 |
| 프로필·사용자 기술·프로젝트 기술 | 통과 | 최초 404→저장·재조회, 기술 추가, 프로젝트 생성·재조회, 타인 프로젝트 403 |
| 저장 공고 목록·상세 | 통과 | 7건 검색·상세·분석 전 상태, 화면 이동·새로고침 |
| 북마크·지원·상태 이력 | 통과 | 저장·지원 등록→전이→이력 2건, 사용자별 빈 목록·대시보드 분리 |
| AI 분석 | 통과(모의/키 없음) | 완료 분석 재사용·실패 상태, 키 없는 요청 `FAILED` 후 원문·CRM 조회 유지. 실제 LLM 호출은 미실행 |
| 공고별 역량 비교·시장 수요·Skill Gap | 통과(합성 표본) | 50% 일치도, 6개 완료 분석 공고·2개 기술 집계, 표본 부족 안내와 Docker 부족 기술 |
| 대시보드 | 통과 | 사용자별 지원·북마크, 지원한 공고 추천 제외, 부족 기술 미리보기, 실제 화면 재조회 |
| Work24 장애·키 없음 | 통과(모의) | S07 DB 회귀의 loopback HTTP 장애·중복·저장 데이터 보존 및 키 없음 검사. 실제 Work24 재호출은 미실행 |
| 로딩·빈 결과·오류·재시도 | 통과(범위 제한) | Frontend 테스트 53건과 기존 3개 화면 스크립트의 모의 오류·빈 상태; 전체 화면의 장애 UI를 이번 통합 브라우저에서 모두 재실행하지는 않음 |

## 설정·문서·남은 결정

- 추적 파일의 일반적 Secret 패턴 검색에서 키 값은 발견하지 못했다. Git에는 `.env.example`만 추적되며 `.env`·`.env.local`·빌드 산출물은 제외된다. Frontend 기본 API는 `/api`, Vite proxy는 같은 출처로 전달하고 쿠키는 HttpOnly·SameSite=Lax·로컬 HTTP에서만 Secure=false다. 배포 HTTPS·역방향 프록시 조합은 미검증이다.
- S03~S16 API가 구현됐는데 API 명세 첫 문단과 Frontend README가 초기 단계 상태를 설명하던 불일치를 수정했다. 사용자 흐름의 S05 숙련도·경험 입력은 후속 구상으로, 개발 계획의 CORS 항목은 확정된 같은 출처 설정으로 명시했다. DB 스키마·REST 계약은 변경하지 않았다. migration 파일은 V1~V8 순서로 유지했다.
- 운영 배포 대상, 같은 출처 `/api` 제공·HTTPS·Secure 쿠키 설정을 사용자가 정한 뒤 검증해야 한다. Work24의 승인된 저장·AI 사용 범위와 호출 빈도 한도도 확인이 남았다. 실제 Work24/LLM 호출, 운영 DB migration, 실서비스 배포는 이번 작업에서 실행하지 않았다.
- 재현: 격리 PostgreSQL에 새 단계 이름 DB를 만들고 Backend `DB_HOST`·`DB_PORT`·`DB_NAME`·`DB_USERNAME`·`DB_PASSWORD`를 주입해 `build`와 각 `dbTest`를 실행한다. S17 HTTP/브라우저는 새 `devjob_s17_test`에서 Backend를 먼저 기동해 Flyway를 적용하고 fixture를 넣은 뒤 [Backend README](../backend/README.md)와 [Frontend README](../frontend/README.md)의 환경 설정으로 실행한다. 스크립트는 계정을 생성하므로 재실행할 때는 새 일회용 DB를 사용한다.

## main 통합과 로컬 시연 (2026-10-07)

S17을 main에 충돌 없이 반영한 뒤 Backend build·일반 테스트 97건과 Frontend build·테스트 53건을 재확인했다. 별도 Compose 프로젝트 `devjob-s17-demo`의 신규 `devjob_s17_test` DB에 Flyway V1~V8과 합성 공고 7건을 적용하고 실제 HTTP 통합 스크립트를 통과했다. Backend `127.0.0.1:8097`, Frontend `127.0.0.1:5173`과 같은 출처 API proxy가 응답했으며 브라우저에서 회원가입 화면을 열었다. 이 로컬 시연은 운영 배포가 아니며 기존 개발 DB를 사용하지 않았다.
