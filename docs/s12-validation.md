# S12 AI 공고 분석 검증 (2026-10-06)

## 범위와 계약

- 로컬 `main`의 S11 통합 커밋 `23c576d`에서 분리한 worktree에서 작업했다. `main`은 수정하지 않았다.
- 교육프로그램의 OpenAI 호환 API 주소 `https://copa.codyssey.kr`, 채팅 경로 `/v1/chat/completions`, 모델 `gpt-5.4-mini`를 사용한다. 제공된 모델 목록의 차감 배수는 0.5다. 교육프로그램의 금액 요금·계정 잔여 한도는 확인되지 않아 금액을 추정하지 않았다. Secret은 서버 환경변수 `OPENAI_API_KEY`에서 읽으며 Git에는 값이 없다.
- 로그인한 사용자가 상세에서 요청하면 비동기 `202 PENDING`을 반환한다. 동일 공고의 진행 중 요청은 합쳐지고 완료 결과는 `200`으로 재사용한다. 5분 이상 남은 `PENDING`은 명시적 재요청으로 다시 접수한다. 실패 상태는 원문·북마크·지원 조회와 분리한다.
- JSON 구조·기술명·요구 유형을 검증한다. 기존 Skill·별칭을 정규화하고, 사용자 결정에 따라 유효한 미등록 기술은 공통 Skill·표준명 별칭을 만든다. 중복 기술은 필수가 우선한다. 유효한 구조화 결과만 JSONB와 JobSkill에 저장한다.

## 실행 결과

- Backend `gradlew.bat build`: 성공, 일반 테스트 92건 통과. Frontend `pnpm build`와 `pnpm test`: 성공, 44건 통과.
- 새 PostgreSQL 17 컨테이너의 `devjob_s12_test`에 Flyway V1~V8을 순서대로 적용하고 JPA `validate`를 통과했다. `ai_analysis`, `job_skill` 테이블을 확인했다. `gradlew.bat dbTest`는 총 64건 중 14건 실행·통과, 다른 단계 전용 DB 이름 가드 50건 건너뜀. S12 DB 5건에서 성공 저장·별칭/미등록 기술·필수 우선 중복 제거·완료 재사용, 무효 출력 후 실패/재시도, 제공자 예외 후 공고·목록 조회, 진행 중 중복 요청, 인증·CSRF·없는 공고를 검증했다.
- 첫 S12 DB 실행에서 비동기 완료가 `PENDING`에 머문 원인은 JVM `Instant`의 나노초와 PostgreSQL TIMESTAMPTZ의 마이크로초 정밀도 차이였다. 시도 식별 시각을 마이크로초로 맞춘 뒤 S12 테스트와 전체 DB 회귀가 통과했다.
- 초기에는 OpenAI 직접 URL을 사용해 401이었고, 교육 API 주소로 바꾼 뒤 이전 프로세스 키로는 `401 authentication_failed`였다. 사용자에게 받은 새 virtual key를 일회성 테스트 프로세스에 주입하자 비용 없는 `GET /v1/models` 인증이 통과했고 `gradlew.bat aiLiveTest`의 실제 `gpt-5.4-mini` 분석 응답 1건이 형식 검증을 통과했다. 실제 제공기관 결과의 DB 저장은 별도로 실행하지 않았으며 저장·재사용은 모의 제공자와 실제 DB로 검증했다. 키 원문·응답 원문은 저장하거나 보고서에 기록하지 않았다. 채팅에 게시된 키는 검증 후 재발급이 필요하다.

## main 통합 시 주의

- `V8__create_job_analysis.sql`은 기존 V1~V7 뒤에 적용한다. 기존 migration 파일이나 Flyway 이력을 변경·초기화하지 않는다. 예전에 S05 단독 V3을 적용한 DB에는 통합본을 그대로 실행하지 말고 이력과 checksum을 먼저 확인한다.
- 교육프로그램 virtual key를 `OPENAI_API_KEY`로 서버에 주입하고, 해당 기관의 토큰 한도와 키 권한을 확인한다. `AI_BASE_URL`은 다른 호환 서버가 필요한 경우에만 지정한다. 브라우저에는 키를 전달하지 않는다.
- S13의 공고별 사용자 기술 비교·적합도와 S14 시장 집계는 이 작업에 포함하지 않았다.
