# DevJob Backend · S01

Java 17, Spring Boot 3.5.16, Gradle Wrapper 8.14.3, PostgreSQL 17을 사용한다.
MVC / Spring Data JPA / Jakarta Validation / Flyway / PostgreSQL driver / Spring Boot Test만 구성한다.
인증, AI, Frontend, 도메인 Entity·Repository·API는 후속 단계의 범위다.

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
