# 로컬 고정 데이터 환경

로컬 앱의 지속 사용 DB는 Docker Compose 프로젝트 `devjob-live`, 컨테이너 `devjob-live-postgres-1`, DB `devjob_live`, 볼륨 `devjob-live_postgres-data`, 호스트 포트 `127.0.0.1:55450`이다. 테스트 DB와 기존 `devjob`·`devjob-s17-demo` 컨테이너는 별개다. 기존 데이터는 삭제하거나 이 DB로 복사하지 않았다.

루트의 무시된 `.env.live`는 DB 접속 정보와 공공 API 키를 보관한다. Git에 추가하지 않는다. 이 파일의 `DB_NAME=devjob_live`, `DB_HOST=127.0.0.1`, `DB_PORT=55450`을 고정하고, Backend는 `scripts/start-live.ps1`로 기동한다. 시작 스크립트는 다른 DB 대상이면 실행을 거부한다. Backend JAR을 새로 빌드한 뒤 기존 API 프로세스를 종료하고 스크립트를 다시 실행한다. Frontend 개발 서버의 `/api` 프록시는 무시된 `frontend/.env.local`의 `VITE_API_PROXY_TARGET=http://127.0.0.1:8097`을 사용한다.

AI 분석에는 별도의 `OPENAI_API_KEY`가 필요하다. 기본 체크아웃의 `.env`는 `scripts/start-live.ps1`이 읽지 않으므로, 실제 로컬 서버에서는 무시된 `.env.live`에 이 키를 설정하고 서버를 재시작해야 한다. 키 값은 문서나 Git에 기록하지 않는다.

`docker compose -p devjob-live --env-file .env.live stop postgres`는 데이터를 보존한다. `down -v`와 볼륨 삭제는 사용하지 않는다. 새 DB로 전환했으므로 기존 시연 DB의 계정·개인 기록은 이 환경에 없고 사용자는 새 계정을 등록해야 한다.

2026-10-11 최초 구축에서 기존 ALIO 수동 수집 API가 실제 공공 API 키로 호출됐고, `ALIO_RECRUITMENT` 공고 3건이 저장됐다. 응답은 `PARTIAL_FAILURE`(created 3, rejected 1, failed 0)였으며 성공한 공고는 유지됐다. 수집을 위해 만든 임시 계정은 삭제했다. 이후 공고 조회는 저장된 DB를 읽으며 화면 진입만으로 외부 API를 다시 호출하지 않는다.

2026-10-12에는 관리자 전체 수집 API로 진행 중인 정보통신 NCS `R600020` 공고를 마지막 페이지까지 수집했다. 결과는 `COMPLETED`, 처리 3페이지, 신규 39건, 중복 3건, 거절·실패 0건이다. DB의 ALIO 공고는 총 42건이며 수집용 임시 계정은 삭제했다. 이 배치는 일반 사용자 수동 수집 API의 3페이지·제목 IT 키워드 제한을 적용하지 않는다.
