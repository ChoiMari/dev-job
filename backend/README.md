# DevJob Backend · MVP

## S17 · 격리 통합 검증

개발 DB 대신 새 PostgreSQL 17 테스트 컨테이너를 사용한다. `DB_HOST`·`DB_PORT`·`DB_USERNAME`·`DB_PASSWORD`를 해당 컨테이너에 맞추고 `DB_NAME=devjob_s17_test`로 새 DB를 만든다. `OPENAI_API_KEY`와 `WORK24_AUTH_KEY`는 키 없는 장애 회귀에서 설정하지 않는다. `build`는 DB 없이 실행하고 `dbTest`는 `DB_NAME`에 맞는 단계별 DB 테스트를 매 호출마다 실행한다. 다른 단계의 가드된 테스트까지 검증하려면 그 이름의 새 DB를 각각 만들고 `dbTest`를 다시 실행한다. S07 테스트는 테이블을 비우므로 반드시 일회용 `devjob_s07_test`에서만 실행한다.

S17 HTTP·브라우저 흐름을 재현할 때는 새 `devjob_s17_test`에 Backend를 먼저 기동해 Flyway V1~V8을 적용한 뒤 [S17 fixture](src/test/resources/fixtures/s17-integration.sql)를 한 번만 입력한다. 이 SQL은 DB 이름과 기존 공고 부재를 확인한다. Backend는 로컬 HTTP에서만 `SESSION_COOKIE_SECURE=false`로 실행하고 Frontend는 `VITE_API_PROXY_TARGET`을 해당 Backend URL로 설정한다. 실행 스크립트와 검증 범위는 [S17 보고](../docs/s17-validation.md)에 있다.

## S06 · 프로젝트 관리

`com.devjob.project`에 Project·ProjectSkill, DTO·Controller·Service·Repository를 추가했다.
`/api/me/projects`의 목록·등록과 `/{projectId}`의 상세·수정·삭제는 S03 세션 인증을 사용하고
변경 요청은 CSRF 토큰을 요구한다. 계약은 `docs/api-spec.md` 3절이다.
`V5__create_projects.sql`은 프로젝트 테이블만 추가하며 기존 migration을 수정하지 않는다.
기존 DB의 적용 이력을 먼저 확인하고 S05의 기술 V3 이력 DB에 통합본을 직접 적용하지 않는다.

검증용 새 PostgreSQL DB에서 다음을 실행한다. 개발 DB로 S06 테스트를 실행하지 않는다.

```powershell
# DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD를 격리 PostgreSQL에 맞춰 설정한다.
$env:DB_NAME = 'devjob_s06_test'
.\gradlew.bat build dbTest --offline --no-daemon
```

S06 테스트는 `DB_NAME`와 실제 DB 이름을 모두 확인하며 트랜잭션을 롤백한다.
2026-10-06 build·일반 84개, S06 DB 7개·기존 DB 회귀 9개가 통과했다.
다른 단계의 DB 이름 가드로 26개를 건너뛰었고, 별도 새 S05 DB에서 기술 회귀 6개도 통과했다.
아래 S01 설명은 초기 기반 구성 당시의 기록이다.

## S11 · 지원·상태 이력

S11 지원·상태 이력은 [검증 보고](../docs/s11-validation.md)와 [API 명세 5절](../docs/api-spec.md#5-북마크와-지원-관리)를 따른다. `V7__create_applications.sql`은 기존 V1~V6 뒤에 새 지원·이력 테이블만 추가한다. S11 DB 테스트는 `DB_NAME=devjob_s11_test`인 별도 검증 DB에서 실행한다. 기존 DB의 Flyway 이력을 수정하거나 초기화하지 않는다.

## S12 · AI 공고 분석

교육기관 코디세이의 OpenAI 호환 API(`https://copa.codyssey.kr`)에서 `gpt-5.4-mini`를 사용한다. 발급받은 virtual key를 서버 프로세스의 `OPENAI_API_KEY`에 주입한다. 키를 사용하지 않을 때는 변수를 설정하지 않는다. 빈 문자열로 설정하면 Spring AI 초기화가 실패한다. 키가 없으면 새 AI 분석 요청은 `503`이 되지만 저장 공고·CRM 조회는 계속 동작한다. 만료·무효 키는 제공기관 인증 실패로 분석 결과가 `FAILED`가 된다. 키는 `.env` 등 Git 제외 파일 또는 환경변수로만 관리하고 로그·응답에 넣지 않는다. `AI_BASE_URL`은 테스트·운영 환경에서 호환 API 주소를 바꿀 때만 사용한다.

S12는 `V8__create_job_analysis.sql`을 추가한다. 새 격리 DB `devjob_s12_test`에서 `build dbTest`를 실행해 Flyway V1~V8과 분석 성공·무효 출력·외부 실패·재사용을 검증한다. 실제 제공기관 호출은 `OPENAI_API_KEY`, `DB_NAME=devjob_s12_test`, `AI_LIVE_TEST=true`를 주입한 뒤 `aiLiveTest`를 명시적으로 실행할 때만 발생한다.

Java 17, Spring Boot 3.5.16, Gradle Wrapper 8.14.3, PostgreSQL 17을 사용한다.
아래 S01 기반 구성 설명은 초기 상태를 기록한 것이며 현재 Backend에는 인증·AI·도메인 API가 포함된다.

## PostgreSQL 실행

저장소 루트에서 `.env.example`을 `.env`로 복사하고 `DB_PASSWORD`에 로컬 비밀번호를 설정한다.
`.env`는 Git에서 제외한다. DB 이름·사용자·포트는 필요하면 함께 변경한다.

```powershell
Copy-Item .env.example .env
# .env의 DB_PASSWORD를 설정한 뒤 실행
docker compose up -d --wait postgres
docker compose ps
```

DB 포트는 호스트의 127.0.0.1에만 공개하며 named volume에 데이터를 보존한다.
PostgreSQL 초기화 환경변수는 새 volume에서만 적용된다. 기존 volume의 비밀번호를
변경할 때는 실제 DB 계정도 변경해야 한다. `docker compose down`은 데이터를 유지한다.

## Backend 실행과 검증

Spring Boot는 Compose의 `.env`를 자동으로 읽지 않는다. 저장소 루트의 PowerShell에서
다음과 같이 현재 프로세스의 환경변수로 읽은 뒤 실행한다. 예제 파일은 단순 `KEY=VALUE` 형식이다.

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
    }
}
Set-Location backend
.\gradlew.bat build
.\gradlew.bat dbTest
.\gradlew.bat bootRun
```

Linux/macOS에서는 같은 DB 환경변수를 export한 뒤 `sh ./gradlew build`, `sh ./gradlew dbTest`,
`sh ./gradlew bootRun`을 사용한다. JDK 17과 Docker Compose가 필요하고 첫 실행은 Gradle 및
의존성을 다운로드한다. HTTP 기본 포트는 8080이며 `SERVER_PORT`로 변경할 수 있다.

- `build`: 실제 DB 없이 컴파일·패키징·공통 MVC 오류/입력 검증 테스트.
- `dbTest`: 실제 PostgreSQL이 필요하다. 전체 애플리케이션과 내장 HTTP 서버 기동,
  JDBC `select 1`, UTF-8, Flyway 이력 테이블을 검증한다. DB가 없으면 실패한다.
- 프로덕션 코드에 테스트용 API를 추가하지 않는다. 기동 후 존재하지 않는 경로에
  요청하면 HTTP 404와 `{ "code": "NOT_FOUND", "message": "요청한 대상을 찾을 수 없습니다." }`를 반환한다.

## 패키지와 계약

`com.devjob`가 컴포넌트·Entity·Repository 검색 루트다.
`common/controller`, `common/service`, `common/repository`에 경계를 정의했고,
후속 단계는 `com.devjob.<domain>/{controller,service,repository,entity,dto}`로 구성한다.
DTO 입력에는 `@Valid`와 Jakarta Validation 제약을 사용한다. MVC 메서드 파라미터의
제약은 Spring MVC 기본 메서드 검증을 사용한다.

오류는 MVC advice와 servlet `/error`에서 동일한 `code`, `message` JSON을 반환한다.
오류 코드 문자열은 API 명세에서 구체적으로 지정하지 않은 상태별 내부 식별자다.
400·401·403·404·409·500·502·503 상태를 유지하고 내부 예외 메시지는 응답에 포함하지 않는다.
Spring Security와 실제 인증·소유권 검사는 S03 이후에 구성한다.

## 스키마 적용

사용자 결정에 따라 Flyway와 JPA `validate`를 사용한다. SQL 자동 초기화는 비활성화한다.
S01은 도메인 테이블을 생성하지 않으며 Flyway 이력 테이블만 만든다.
첫 Entity 단계에서 `src/main/resources/db/migration/V1__description.sql`부터 시작한다.
기존 schema에 대한 자동 baseline이나 clean을 설정하지 않는다.
ERD·API의 설계 계약은 변경하지 않았다.

## S09 · 고용24 공채속보 연동

S09의 Work24 연동 범위는 **공채속보 목록**으로 확정했으며 구현·검증 완료다.
`Work24Adapter`는 개인회원 승인 범위의 목록만 사용한다.
일반 채용정보목록·상세와 공채속보 상세는 현재 연동 범위에서 제외한다. 공식 근거·필드 한계는
[architecture S09](../docs/architecture.md#s09-공식-접근계약-조사-2026-10-06)를 참고한다.

키는 Windows 사용자 환경에 한 번 등록한다. 아래 입력은 화면·명령 이력에 키를 남기지 않는다.
사용자 환경 등록은 로컬 편의를 위한 설정이며 암호화된 비밀 저장소는 아니다.
실제 키를 명령 인자·소스·.env 파일·Git·로그에 넣지 않는다.

```powershell
$s09SecureKey = Read-Host '고용24 인증키' -AsSecureString
$s09Credential = [System.Net.NetworkCredential]::new('', $s09SecureKey)
[Environment]::SetEnvironmentVariable('WORK24_AUTH_KEY', $s09Credential.Password, 'User')
Remove-Variable s09SecureKey, s09Credential
```

현재 PowerShell에서 Backend를 실행하기 전에 값을 출력하지 않고 프로세스로 읽는다.
기존 실행 중인 서버는 재시작해야 새 환경값을 사용한다.

```powershell
$env:WORK24_AUTH_KEY = [Environment]::GetEnvironmentVariable('WORK24_AUTH_KEY', 'User')
Set-Location backend
.\gradlew.bat bootRun
```

키가 없으면 애플리케이션은 기동하며 수집 요청만 SOURCE_FAILED로 처리한다.
수집은 서버 내부에서 기존 서비스와 Adapter를 주입해 명시적으로 실행하는 경계다.
아래는 내부 호출 예시이며 실행용 REST API·CLI·기동 작업은 추가하지 않았다.

```java
collection.collect(work24Adapter, new JobSearchCondition(keyword, 0, 20));
```

한 번에 한 페이지만 요청하며 공채속보 제목 검색을 사용한다. 본문·경력·지역·날짜는
이번 목록 매핑에서 null이다. 추가 상세·전체 페이지 순회·자동 재시도를 하지 않는다.
저장·재배포·AI 용도와 실제 호출 빈도 한도는 제공기관 승인 조건을 더 확인해야 한다.

실제 연동 테스트는 일반 build·dbTest에서 제외된다. 승인된 키를 프로세스에 주입하고
아래 명시적 opt-in 명령을 실행하면 목록 1회(display=1)를 호출한다.
빈 목록도 허용하며 응답 내용·키를 출력하지 않고 DB에 쓰지 않는다.

```powershell
try {
    $env:WORK24_AUTH_KEY = [Environment]::GetEnvironmentVariable('WORK24_AUTH_KEY', 'User')
    $env:WORK24_LIVE_TEST = 'true'
    .\gradlew.bat work24LiveTest --no-daemon
} finally {
    Remove-Item Env:WORK24_AUTH_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:WORK24_LIVE_TEST -ErrorAction SilentlyContinue
}
```

Work24 DB 회귀는 loopback 모의 제공기관+실제 PostgreSQL을 사용한다.
`DB_NAME=devjob_s07_test`인 **격리된 일회용 DB**만 사용해야 한다.
테스트가 공고·회사·출처 테이블을 비우므로 기존 개발 DB를 이 이름으로 지정하지 않는다.
DB_HOST·DB_PORT·DB_USERNAME·DB_PASSWORD를 격리 DB에 맞춰 주입한 뒤 `dbTest`를 실행한다.
이번 작업의 검증 결과는 일반 73건·DB 20건·실제 smoke 1건 통과이며 새 migration은 없다.

## 청년일자리 공공기관 채용정보 연동

사람인 후속 연동 계획을 청년일자리 올인원 서비스의 공공기관 채용정보 출처로 교체했다.
저장소 루트의 Git 제외 `.env`에 `ALIO_SERVICE_KEY`를 설정하고, 위의 Backend 실행 절에
있는 `.env` → 프로세스 환경변수 로딩 후 서버를 실행한다. 키를 명령 인자·소스·로그에
표시하지 않는다. 키가 없어도 CRM 조회와 서버 기동은 유지되며 해당 출처의 수집만 실패한다.

사용자 공고 화면은 DB의 저장 공고만 검색하며 전체·공공기관·고용24 출처를 선택할 수 있다. 외부 수집은 이 화면과 분리된 인증 클라이언트의 세션·CSRF 보호
`POST /api/jobs/collections/alio?keyword=&page=0`가 진행 중인 정보통신 NCS 목록의 지정 페이지(기본 첫 페이지)에서 SW·데이터·보안 중심 제목만 선택해 공고별 상세를 조회한다. 한글 제목 조건은 제공기관 오류 때문에 선택한 한 페이지의 반환값에서 적용한다. 수집 page는 수동 POST의 파라미터이며 사용자 화면에는 표시하지 않는다. 저장 목록에서는 기본 IT 필터와 전체 공고 전환을 제공한다.
한 번에 최대 20건이며 자동 수집·자동 재시도는 없다. 상세의 전형 단계와 첨부파일 메타정보는 저장하지만
파일 자체는 다운로드하지 않는다. 이 출처 공고의 재수집은 기존 공고 ID와 북마크·지원 기록을
유지하면서 내용을 갱신한다. 상세 실패 시 기존 상세는 보존하고 부분 실패로 보고한다.

2026-10-07 초기 호출은 `resultCode=5`였지만 이후 실제 목록·상세는 HTTP 200·`resultCode=200`으로 성공했다. 명세의 정상 코드 0과 실제 200을 모두 처리하고 실제 `YYYYMMDD` 날짜를 정규화한다. 첫 페이지 20건 중 유효한 원문 URL이 없는 2건은 제외하고 18건의 목록·상세·메타정보를 분리 DB와 브라우저에서 확인했다. 운영 전 제공기관의 저장·재표시·AI 활용
조건과 호출 한도를 확인한다. DB 회귀는 `DB_NAME=devjob_alio_test`인 격리된 일회용 DB에서만
실행되며 테스트가 공고·사용자 데이터를 비우므로 개발 DB 이름을 바꾸어 실행하지 않는다.
