\# DevJob Architecture



\## 1. 문서 목적



본 문서는 \*\*DevJob\*\*의 시스템 구조와 주요 기술 선택 이유를 정의한다.



주요 내용:



\* 전체 시스템 구조

\* Backend / Frontend 구조

\* 데이터 저장 구조

\* 외부 채용 API 연동

\* AI 분석 구조

\* Skill 표준화 구조

\* 인증 및 보안

\* 장애 처리

\* 기술 선택 이유

\* MVP 범위와 확장 방향



\---



\# 2. Architecture Goal



DevJob의 아키텍처는 다음 목표를 가진다.



1\. 일반적인 취업지원 CRM 기능이 안정적으로 동작할 것

2\. 외부 채용 데이터를 내부 데이터 구조로 표준화할 것

3\. LLM을 활용해 비정형 채용공고를 구조화할 것

4\. AI 기능이 실패해도 CRM 핵심 기능은 사용할 수 있을 것

5\. 외부 채용 API와 LLM 제공업체 변경에 유연하게 대응할 것

6\. 신입 개발자가 각 기술 선택의 이유를 설명할 수 있을 정도로 단순하게 유지할 것

7\. MVP 이후 기능을 확장할 수 있는 구조를 확보할 것



\---



\# 3. Overall Architecture



DevJob은 기본적으로 \*\*Frontend + Spring Boot Backend + PostgreSQL + External Services\*\* 구조를 사용한다.



```text

&#x20;                        ┌──────────────────────┐

&#x20;                        │      User            │

&#x20;                        └──────────┬───────────┘

&#x20;                                   │

&#x20;                                   ▼

&#x20;                        ┌──────────────────────┐

&#x20;                        │   React Frontend     │

&#x20;                        │                      │

&#x20;                        │ - Dashboard          │

&#x20;                        │ - Job                │

&#x20;                        │ - Application        │

&#x20;                        │ - Skill Analysis     │

&#x20;                        │ - Profile            │

&#x20;                        └──────────┬───────────┘

&#x20;                                   │ REST API

&#x20;                                   ▼

&#x20;                   ┌────────────────────────────────┐

&#x20;                   │       Spring Boot Backend       │

&#x20;                   │                                │

&#x20;                   │ ┌────────────────────────────┐ │

&#x20;                   │ │ Controller                 │ │

&#x20;                   │ └─────────────┬──────────────┘ │

&#x20;                   │               ▼                │

&#x20;                   │ ┌────────────────────────────┐ │

&#x20;                   │ │ Application / Service      │ │

&#x20;                   │ └──────┬──────────┬─────────┘ │

&#x20;                   │        │          │           │

&#x20;                   │        ▼          ▼           │

&#x20;                   │   Job Domain   AI Analysis    │

&#x20;                   │        │          │           │

&#x20;                   │        ▼          ▼           │

&#x20;                   │   Repository   Spring AI      │

&#x20;                   └────────┬──────────┬───────────┘

&#x20;                            │          │

&#x20;                            ▼          ▼

&#x20;                   ┌─────────────┐  ┌──────────────┐

&#x20;                   │ PostgreSQL  │  │ External LLM │

&#x20;                   └─────────────┘  └──────────────┘

&#x20;                            ▲

&#x20;                            │

&#x20;                   ┌────────┴──────────┐

&#x20;                   │ External Job APIs │

&#x20;                   │                  │

&#x20;                   │ Work24           │

&#x20;                   │ Saramin(optional)│

&#x20;                   └──────────────────┘

```



\---



\# 4. Technology Stack



\## 4.1 Frontend



| 영역             | 기술                       |

| -------------- | ------------------------ |

| Framework      | React                    |

| Language       | JavaScript 또는 TypeScript |

| UI             | CSS / UI Component       |

| Communication  | REST API                 |

| Authentication | Backend 인증 방식에 맞춰 처리     |



Frontend는 DevJob의 화면과 사용자 인터랙션을 담당한다.



\---



\# 4.2 Backend



| 영역         | 기술                       |

| ---------- | ------------------------ |

| Language   | Java                     |

| Framework  | Spring Boot              |

| API        | Spring MVC / REST        |

| ORM        | Spring Data JPA          |

| Security   | Spring Security          |

| Validation | Jakarta Bean Validation  |

| AI         | Spring AI                |

| Build      | Gradle                   |

| Test       | JUnit / Spring Boot Test |



Backend는 DevJob의 핵심 비즈니스 로직과 외부 서비스 연동을 담당한다.



\---



\# 4.3 Database



| 영역                 | 기술                         |

| ------------------ | -------------------------- |

| RDBMS              | PostgreSQL                 |

| ORM                | Spring Data JPA            |

| Migration          | Flyway SQL migration (S01 확정) |

| Character Encoding | UTF-8                      |



PostgreSQL은 다음 데이터를 저장한다.

S01에서 스키마 적용 방식은 Flyway SQL migration으로 확정했다. JPA는 `ddl-auto=validate`로 매핑만 검증하며, 자동 생성·갱신하지 않는다. 도메인 테이블은 각 후속 단계에서 Entity와 migration을 함께 추가한다.



\* 사용자

\* 프로필

\* Skill

\* Skill Alias

\* Project

\* Company

\* Job Source

\* Job Posting

\* Job Skill

\* Bookmark

\* Application

\* Application Status History

\* AI Analysis Result



\---



\# 4.4 Infrastructure



MVP에서는 복잡한 인프라를 도입하지 않는다.



사용 기술:



\* Docker

\* Docker Compose

\* Git

\* GitHub



MVP에서는 다음을 사용하지 않는다.



\* Kubernetes

\* Kafka

\* Redis

\* GraphQL

\* 복잡한 Microservice Architecture



\---



\# 5. Monolithic Architecture



DevJob MVP는 \*\*Modular Monolith\*\* 구조를 기본으로 한다.



즉, 하나의 Spring Boot 애플리케이션 안에서 도메인을 분리한다.



```text

Spring Boot Application



├── user

├── profile

├── skill

├── project

├── company

├── job

├── application

├── ai

└── analytics

```



각 도메인은 내부적으로 다음 구조를 가질 수 있다.



```text

domain/

├── controller

├── service

├── repository

├── entity

└── dto

```



\---



\# 6. Why Modular Monolith?



DevJob은 처음부터 Microservice로 분리하지 않는다.



\## 이유



\### 1. 프로젝트 규모



MVP 단계에서 서비스 규모가 크지 않다.



\### 2. 운영 복잡도 감소



Microservice를 사용하면 다음 관리 대상이 늘어난다.



\* 서비스 간 통신

\* 배포

\* 장애 추적

\* 인증

\* 로그

\* 네트워크

\* 데이터 일관성



현재 DevJob에서는 이러한 복잡성이 얻는 이점보다 크다.



\### 3. 도메인 분리는 유지



Monolith라고 해서 모든 코드를 한 곳에 섞지 않는다.



도메인 경계를 명확하게 유지한다.



향후 특정 영역의 규모가 커질 경우 독립 서비스로 분리할 수 있도록 설계한다.



\---



\# 7. Backend Layer



기본 Backend 구조는 다음과 같다.



```text

Controller

&#x20;   ↓

Service

&#x20;   ↓

Repository

&#x20;   ↓

Database

```



외부 시스템 연동이 필요한 경우:



```text

Controller

&#x20;   ↓

Service

&#x20;   ↓

External Client / Adapter

&#x20;   ↓

External API

```



AI 분석의 경우:



```text

Controller

&#x20;   ↓

AI Service

&#x20;   ↓

Spring AI

&#x20;   ↓

External LLM

```



\---



\# 8. Domain Structure



\## 8.1 User / Profile



사용자의 기본 계정과 취업 프로필을 관리한다.



```text

User

&#x20;│

&#x20;└── Profile

&#x20;      │

&#x20;      ├── UserSkill

&#x20;      │       ↓

&#x20;      │      Skill

&#x20;      │

&#x20;      └── Project

&#x20;              ↓

&#x20;         ProjectSkill

&#x20;              ↓

&#x20;            Skill

```



\---



\# 8.2 Skill Domain



Skill은 DevJob의 핵심 공통 데이터다.



주요 객체:



```text

Skill

SkillAlias

UserSkill

ProjectSkill

JobSkill

```



\---



\## Skill



표준화된 기술을 저장한다.



예:



```text

id: 1

name: PostgreSQL

```



\---



\## SkillAlias



동일 기술을 여러 표현으로 입력할 수 있도록 관리한다.



예:



```text

Postgres → PostgreSQL

Postgre SQL → PostgreSQL

postgresql → PostgreSQL

```



구조:



```text

Skill

&#x20; │

&#x20; └── SkillAlias

&#x20;       ├── Postgres

&#x20;       ├── postgres

&#x20;       └── Postgre SQL

```



이를 통해 서로 다른 데이터 소스에서 들어오는 기술명을 하나의 Skill로 통합한다.



\---



\# 9. Job Domain



채용공고 관련 도메인이다.



주요 객체:



```text

JobSource

Company

JobPosting

JobSkill

```



관계:



```text

JobSource

&#x20;   │

&#x20;   └── JobPosting

&#x20;           │

&#x20;           ├── Company

&#x20;           │

&#x20;           └── JobSkill

&#x20;                   │

&#x20;                   └── Skill

```



\---



\# 10. External Job API Adapter



외부 채용 API마다 응답 구조가 다를 수 있기 때문에 Adapter 구조를 사용한다.



```text

&#x20;                JobSourceAdapter

&#x20;                      │

&#x20;         ┌────────────┼────────────┐

&#x20;         ↓            ↓            ↓

&#x20;Work24Adapter   SaraminAdapter   FutureAdapter

&#x20;         │            │

&#x20;         ▼            ▼

&#x20;      Work24       Saramin

```



공통 인터페이스 예시:



```java

public interface JobSourceAdapter {



&#x20;   List<ExternalJobPosting> fetchJobs(JobSearchCondition condition);



}

```



각 외부 API의 응답을 내부 표준 모델로 변환한다.



```text

External API Response

&#x20;       ↓

Adapter

&#x20;       ↓

ExternalJobPosting

&#x20;       ↓

JobPosting

&#x20;       ↓

PostgreSQL

```



\---



\# 11. Why Adapter Architecture?



외부 채용 데이터 제공자는 각각 다른 데이터 구조를 사용할 수 있다.



예:



```text

Work24

title

company

career

location



Saramin

jobTitle

corpName

careerLevel

area

```



Backend Service가 각각의 API 구조를 직접 알게 만들면 외부 API가 추가될 때 기존 코드 수정 범위가 커진다.



따라서:



```text

Service

&#x20;  ↓

JobSourceAdapter

&#x20;  ↓

외부 API

```



구조로 분리한다.



이렇게 하면 새로운 채용 데이터 소스를 추가할 때 기존 Job Domain의 변경을 최소화할 수 있다.



\---



\# 12. Job Normalization



외부 채용공고는 DevJob 내부의 공통 구조로 변환한다.



```text

External Job Data

&#x20;      ↓

Normalization

&#x20;      ↓

JobPosting

```



예:



```text

외부 데이터



corpName

jobTitle

careerLevel

area



&#x20;      ↓



DevJob



Company

title

career

location

```



\---



\# 13. Duplicate Detection



여러 외부 데이터 소스에서 동일한 채용공고가 수집될 수 있다.



따라서 저장 전에 중복 여부를 확인한다.



기본적으로 다음 정보를 활용할 수 있다.



\* Source

\* External Job ID

\* Company

\* Job URL

\* Title

\* 기타 식별 정보



가장 우선적으로 외부 제공자의 고유 ID를 사용한다.



```text

Source + ExternalJobId

&#x20;       ↓

중복 확인

&#x20;  ├── 존재 → 기존 데이터 처리

&#x20;  └── 없음 → 신규 저장

```



\---



\# 14. AI Architecture



DevJob의 AI는 별도의 Python 모델 서버가 아니라 \*\*Spring Boot 내부의 AI Analysis Layer\*\*에서 처리한다.



```text

JobPosting

&#x20;   ↓

AI Analysis Service

&#x20;   ↓

Spring AI

&#x20;   ↓

External LLM API

&#x20;   ↓

Structured Output

&#x20;   ↓

Validation

&#x20;   ↓

Skill Normalization

&#x20;   ↓

AI Analysis Result

&#x20;   ↓

JobSkill

```



\---



\# 15. Why Spring AI?



DevJob의 AI 기능은 현재 다음 목적이다.



> 채용공고의 비정형 텍스트를 분석하여 구조화된 채용 요구사항으로 변환한다.



예:



```text

"Java와 Spring Boot 개발 경험 필수,

AWS 및 Docker 경험자 우대"

```



를



```json

{

&#x20; "requiredSkills": \[

&#x20;   "Java",

&#x20;   "Spring Boot"

&#x20; ],

&#x20; "preferredSkills": \[

&#x20;   "AWS",

&#x20;   "Docker"

&#x20; ]

}

```



형태로 변환한다.



현재 DevJob에는 직접 학습하거나 실행해야 하는 Python 기반 모델이 핵심이 아니다.



따라서 별도의 FastAPI 서버를 두는 것보다 Spring Boot에서 Spring AI를 사용하는 편이 구조적으로 단순하다.



\---



\# 16. Why Not FastAPI in MVP?



FastAPI를 사용하지 않는 이유는 FastAPI가 나쁜 기술이기 때문이 아니다.



현재 DevJob의 AI 요구사항과 맞지 않기 때문이다.



FastAPI가 특히 유리해지는 경우:



\* PyTorch 모델 실행

\* Hugging Face Transformers

\* 직접 학습한 모델

\* Reranker

\* Embedding Model

\* Python 기반 데이터 처리

\* GPU inference

\* 별도의 ML pipeline



등이 핵심이 될 경우다.



현재는:



```text

Spring Boot

&#x20;   ↓

Spring AI

&#x20;   ↓

External LLM

```



구조로 충분하다.



향후 Python 기반 AI 모델이 필요해질 경우:



```text

Spring Boot

&#x20;    │

&#x20;    ├── CRM API

&#x20;    │

&#x20;    └── AI API

&#x20;           ↓

&#x20;        FastAPI

&#x20;           ↓

&#x20;      Python Model

```



형태로 확장할 수 있다.



\---



\# 17. AI Structured Output



LLM의 자유로운 자연어 응답을 그대로 DB에 저장하지 않는다.



```text

LLM

&#x20;↓

Structured Output

&#x20;↓

Schema Validation

&#x20;↓

Domain Validation

&#x20;↓

Database

```



예:



```json

{

&#x20; "requiredSkills": \[

&#x20;   "Java",

&#x20;   "Spring Boot"

&#x20; ],

&#x20; "preferredSkills": \[

&#x20;   "Docker",

&#x20;   "AWS"

&#x20; ]

}

```



\---



\# 18. AI Validation



LLM 결과는 항상 신뢰할 수 있다고 가정하지 않는다.



따라서 다음 단계에서 검증한다.



```text

LLM Output

&#x20;   ↓

JSON / Schema Validation

&#x20;   ↓

Required Field Validation

&#x20;   ↓

Skill Validation

&#x20;   ↓

Skill Normalization

&#x20;   ↓

Persistence

```



예를 들어 AI가:



```text

"Spring"

```



을 반환하면 내부 Skill Alias를 통해 표준 Skill과 연결할 수 있다.



\---



\# 19. Required / Preferred Classification



채용공고의 기술 요구사항은 최소한 다음 두 종류로 구분한다.



```text

JobSkill



type

├── REQUIRED

└── PREFERRED

```



예:



```text

Java          REQUIRED

Spring Boot   REQUIRED

PostgreSQL    REQUIRED

Docker        PREFERRED

AWS           PREFERRED

```



이를 이용해 사용자와 채용공고의 역량 비교를 수행한다.



\---



\# 20. AI Analysis Persistence



AI 분석 결과는 매번 LLM을 호출하지 않는다.



```text

JobPosting

&#x20;    ↓

AI Analysis Result 존재?

&#x20;    │

&#x20;┌───┴────┐

&#x20;│        │

YES      NO

&#x20;│        │

&#x20;↓        ↓

재사용   LLM 호출

&#x20;         ↓

&#x20;      결과 저장

```



목적:



\* API 비용 절감

\* 응답시간 감소

\* 동일 결과 재사용

\* 외부 LLM 장애 영향 감소



\---



\# 21. AI Failure Isolation



AI 분석이 실패해도 JobPosting 조회 기능은 정상적으로 동작해야 한다.



```text

JobPosting

&#x20;   │

&#x20;   ├──────────────→ 기본 정보

&#x20;   │                   ↓

&#x20;   │               정상 제공

&#x20;   │

&#x20;   └──────────────→ AI Analysis

&#x20;                       ↓

&#x20;                    FAILED

```



즉,



> AI는 핵심 CRM을 보조하는 분석 계층이며 CRM 자체의 단일 장애 지점이 되어서는 안 된다.



\---



\# 22. AI Cost Control



불필요한 LLM 호출을 최소화한다.



\### 기본 원칙



1\. 이미 분석된 공고는 결과 재사용

2\. 사용자가 요청하지 않은 반복 분석 방지

3\. 가능한 경우 구조화된 출력 사용

4\. 분석 대상 텍스트를 필요한 범위로 제한

5\. 실패한 요청은 무한 자동 재시도하지 않음



\---



\# 23. User ↔ Job Matching



사용자 역량과 채용공고 요구사항을 비교한다.



```text

UserSkill

&#x20;    +

ProjectSkill

&#x20;    +

JobSkill

&#x20;    ↓

Skill Normalization

&#x20;    ↓

Matching

&#x20;    ↓

Match Result

```



예:



```text

Job Required

Java

Spring Boot

PostgreSQL

Docker



User

Java

Spring Boot

PostgreSQL



&#x20;      ↓



Required Match

3 / 4

```



MVP에서는 복잡한 ML 기반 합격 예측을 구현하지 않는다.



\---



\# 24. No Pass Probability



DevJob MVP에서는 다음 기능을 구현하지 않는다.



> "이 회사에 합격할 확률 73%"



이러한 확률은 충분한 학습 데이터와 검증 방법이 없는 상태에서는 신뢰하기 어렵다.



대신 다음과 같은 설명 가능한 정보를 제공한다.



\* 필수 기술 일치 여부

\* 우대 기술 일치 여부

\* 부족한 기술

\* 채용시장 수요

\* 사용자 프로젝트 경험



\---



\# 25. Application Domain



지원 관리는 `Application`을 중심으로 구성한다.



```text

User

&#x20;│

&#x20;└── Application

&#x20;       │

&#x20;       ├── JobPosting

&#x20;       │

&#x20;       └── ApplicationStatusHistory

```



Application은 현재 지원 상태를 가진다.



예:



```text

INTERESTED

PLANNED

APPLIED

DOCUMENT\_PASSED

INTERVIEW

FINAL\_PASSED

REJECTED

WITHDRAWN

```



상태가 변경될 때 필요한 경우 이력을 저장한다.



\---



\# 26. Dashboard Data Flow



Dashboard는 여러 도메인의 데이터를 조합해서 제공한다.



```text

User

&#x20;│

&#x20;├── Application

&#x20;│       ↓

&#x20;│    지원 통계

&#x20;│

&#x20;├── Bookmark

&#x20;│       ↓

&#x20;│    관심 공고

&#x20;│

&#x20;├── JobPosting

&#x20;│       ↓

&#x20;│    추천 / 최근 공고

&#x20;│

&#x20;├── UserSkill

&#x20;│       ↓

&#x20;│    역량 정보

&#x20;│

&#x20;└── Skill Analysis

&#x20;        ↓

&#x20;     Skill Gap

```



Dashboard API에서 필요한 데이터를 조합해서 Frontend에 제공한다.



\---



\# 27. Market Analytics



채용공고에 연결된 Skill 데이터를 기반으로 채용시장 기술 수요를 집계한다.



```text

JobPosting

&#x20;   ↓

JobSkill

&#x20;   ↓

Skill

&#x20;   ↓

GROUP BY Skill

&#x20;   ↓

Skill Demand

```



예:



```text

Skill           Job Count



Java               580

Spring Boot        620

AWS                430

Docker             380

Redis              310

```



초기에는 PostgreSQL의 집계 쿼리로 구현한다.



별도의 데이터 분석 시스템을 구축하지 않는다.



\---



\# 28. Skill Gap Analysis



기본적인 Skill Gap은 다음 데이터를 사용한다.



```text

Required Job Skills

&#x20;      -

User Skills

&#x20;      ↓

Missing Skills

```



여기에 채용시장 수요를 함께 고려한다.



```text

Missing Skill

&#x20;     +

Market Demand

&#x20;     ↓

Learning Priority

```



MVP에서는 명시적인 규칙 기반으로 구현할 수 있다.



\---



\# 29. Authentication



사용자는 인증된 상태에서 자신의 취업 데이터를 관리한다.

S03 확정: Spring Security 기반 서버 세션 + HttpOnly `JSESSIONID` 쿠키를 같은 출처에서 전달한다. 로그인 시 세션 ID와 CSRF 토큰을 교체하고 로그아웃 시 서버 세션을 무효화한다. 세션은 메모리에서 비활동 30분 동안 유지되며 서버 재시작 시 만료된다. 다중 서버·세션 공유 저장소는 이번 범위에 추가하지 않는다.

CSRF는 세션에 저장하고 `GET /api/auth/csrf`로 받은 토큰을 POST의 `X-CSRF-TOKEN` 헤더로 보낸다. Spring Security 필터의 인증·권한 오류도 공통 JSON 계약을 따른다. 인증 Controller → AuthService → UserRepository 경계를 유지하고 Entity를 API에 직접 노출하지 않는다. 세션 인증 주체에는 사용자 ID·이메일만 두고 비밀번호·해시는 포함하지 않는다.

비밀번호는 BCrypt로 저장한다. API에서 UTF-8 최대 72바이트를 검증해 BCrypt 입력 잘림을 막는다. 이메일은 공백 제거·소문자로 정규화하고 DB UNIQUE 제약으로 동시 중복 가입을 막는다. 쿠키 Secure는 기본 true이며 로컬 HTTP에서는 `SESSION_COOKIE_SECURE=false`를 명시한다. Frontend 개발은 Vite `/api` proxy, 배포는 같은 출처의 API 제공을 전제로 한다. 상세 요청·응답은 `api-spec.md` 2절을 따른다.



인증 대상:



\* Profile

\* UserSkill

\* Project

\* Bookmark

\* Application

\* AI 분석 관련 개인화 데이터



다른 사용자의 데이터를 조회하거나 변경할 수 없어야 한다.



\---



\# 30. Authorization



Backend에서 리소스 소유권을 검증한다.



예:



```text

GET /api/applications/{id}



&#x20;       ↓



Application Owner 확인



&#x20;       ├── 현재 사용자 → 허용

&#x20;       └── 다른 사용자 → 거부

```



Frontend에서 버튼을 숨기는 것만으로 접근 제어를 끝내지 않는다.



\---



\# 31. Security



기본적인 보안 원칙을 적용한다.



\* 비밀번호 암호화 저장

\* 인증 정보 안전 관리

\* API 입력값 검증

\* SQL Injection 방지

\* 권한 검증

\* 민감정보 로그 노출 방지

\* 외부 API Key 서버 측 관리

\* CORS 정책 관리

\* 환경변수로 Secret 관리



LLM API Key는 Frontend에 노출하지 않는다.



```text

Frontend

&#x20;  ↓

Spring Boot

&#x20;  ↓

LLM API

```



\---



\# 32. External API Key Management



외부 API Key는 코드에 직접 작성하지 않는다.



```text

application.yml

&#x20;       ↓

Environment Variable

&#x20;       ↓

External API Client

```



예:



```text

OPENAI\_API\_KEY

WORK24\_API\_KEY

```



실제 Secret 값은 Git Repository에 Commit하지 않는다.



\---



\# 33. Error Handling



Backend에서는 외부 시스템 오류와 내부 비즈니스 오류를 구분한다.



예:



```text

400

잘못된 요청



401

인증 필요



403

권한 없음



404

리소스 없음



409

중복 / 상태 충돌



500

서버 내부 오류



502 / 503

외부 시스템 연동 오류

```



Frontend에는 사용자에게 이해 가능한 오류 메시지를 제공한다.



\---



\# 34. External API Failure



외부 채용 API가 실패해도 기존 DB에 저장된 채용공고는 계속 조회할 수 있어야 한다.



```text

External API

&#x20;    ↓

&#x20;   FAIL

&#x20;    ↓

수집 실패 기록

&#x20;    ↓

기존 JobPosting 사용 가능

```



\---



\# 35. Transaction Boundary



하나의 비즈니스 작업에서 반드시 함께 성공해야 하는 DB 변경은 하나의 Transaction으로 처리한다.



예:



```text

지원 상태 변경

&#x20;    ↓

Application 변경

&#x20;    +

StatusHistory 저장

```



두 데이터가 함께 처리되어야 한다.



\---



\# 36. Repository Strategy



Spring Data JPA를 기본 Repository로 사용한다.



```text

Service

&#x20;  ↓

Repository

&#x20;  ↓

JPA

&#x20;  ↓

PostgreSQL

```



복잡한 조회가 필요한 경우 JPQL 또는 QueryDSL 등의 도입을 검토할 수 있다.



MVP에서는 필요한 수준에 맞춰 선택한다.



\---



\# 37. API Style



Frontend와 Backend 간 통신은 REST API를 사용한다.



예:



```text

GET

/api/jobs



GET

/api/jobs/{jobId}



POST

/api/jobs/{jobId}/analysis



POST

/api/bookmarks



POST

/api/applications



PATCH

/api/applications/{applicationId}/status



GET

/api/analytics/skills

```



구체적인 Request / Response 구조는 `api-spec.md`에서 정의한다.



\---



\# 38. Data Flow Example



\## 채용공고 → AI 분석 → Skill 저장



전체 데이터 흐름:



```text

Work24

&#x20;  ↓

Work24Adapter

&#x20;  ↓

JobPosting

&#x20;  ↓

AI Analysis Service

&#x20;  ↓

Spring AI

&#x20;  ↓

External LLM

&#x20;  ↓

Structured Output

&#x20;  ↓

Validation

&#x20;  ↓

Skill Normalization

&#x20;  ↓

JobSkill

&#x20;  ↓

PostgreSQL

```



\---



\# 39. Data Flow Example



\## 사용자 역량 → 채용공고 비교



```text

User

&#x20;│

&#x20;├── UserSkill

&#x20;│

&#x20;└── ProjectSkill

&#x20;         │

&#x20;         ▼

&#x20;      Skill

&#x20;         ▲

&#x20;         │

&#x20;      JobSkill

&#x20;         │

&#x20;         ▲

&#x20;     JobPosting

```



이를 통해 사용자에게:



```text

일치 기술

부족 기술

필수 기술 일치

우대 기술 일치

```



등을 제공한다.



\---



\# 40. Suggested Package Structure



Spring Boot Backend 예시:



```text

src/main/java/com/devjob

│

├── DevJobApplication.java

│

├── global/

│   ├── config/

│   ├── exception/

│   ├── security/

│   └── response/

│

├── user/

│   ├── controller/

│   ├── service/

│   ├── repository/

│   ├── entity/

│   └── dto/

│

├── profile/

│   ├── controller/

│   ├── service/

│   ├── repository/

│   ├── entity/

│   └── dto/

│

├── skill/

│   ├── controller/

│   ├── service/

│   ├── repository/

│   ├── entity/

│   └── dto/

│

├── project/

│

├── company/

│

├── job/

│   ├── controller/

│   ├── service/

│   ├── repository/

│   ├── entity/

│   ├── dto/

│   └── adapter/

│

├── application/

│

├── ai/

│   ├── controller/

│   ├── service/

│   ├── dto/

│   ├── prompt/

│   └── validator/

│

└── analytics/

&#x20;   ├── controller/

&#x20;   ├── service/

&#x20;   └── repository/

```



실제 구현 시 도메인의 크기에 따라 일부 구조는 단순화할 수 있다.



\---



\# 41. Frontend / Backend Responsibility



\## Frontend



담당:



\* UI

\* 사용자 입력

\* 화면 상태

\* API 호출

\* 사용자 인터랙션

\* 데이터 시각화



Frontend에서 하지 않는 것:



\* LLM API 직접 호출

\* 외부 채용 API 직접 호출

\* 인증 우회

\* 비즈니스 규칙 결정



\---



\## Backend



담당:



\* 인증

\* 권한

\* 비즈니스 로직

\* DB 처리

\* 외부 채용 API

\* AI 분석

\* Skill normalization

\* Application 상태 관리

\* 통계 계산



\---



\# 42. AI Boundary



AI 관련 책임은 명확히 분리한다.



```text

Job Domain

&#x20;   ↓

AI Analysis Service

&#x20;   ↓

LLM

```



Job Domain이 특정 LLM 제공업체의 API 호출 방식을 직접 알지 않도록 한다.



예:



```text

JobService

&#x20;   ↓

AiAnalysisService

&#x20;   ↓

LlmClient

```



이를 통해 향후 LLM 제공업체를 변경할 수 있다.



\---



\# 43. AI Provider Abstraction



가능하면 LLM Provider 의존성을 한 곳으로 제한한다.



```text

AiAnalysisService

&#x20;       ↓

LlmClient

&#x20;       ↓

┌───────────────┐

│ External LLM  │

└───────────────┘

```



향후 필요할 경우:



```text

LlmClient

&#x20;   ├── Provider A

&#x20;   ├── Provider B

&#x20;   └── Provider C

```



형태로 확장할 수 있다.



MVP에서 여러 LLM Provider를 동시에 운영하지는 않는다.



\---



\# 44. Logging



로그에는 다음을 기록할 수 있다.



\* API 요청/응답 상태

\* 주요 비즈니스 이벤트

\* 외부 API 오류

\* AI 분석 성공/실패

\* 시스템 오류



다음 정보는 일반 로그에 그대로 기록하지 않는다.



\* 비밀번호

\* API Key

\* Access Token

\* 민감한 사용자 정보

\* 원문 전체가 필요한 이유 없이 포함된 개인정보



\---



\# 45. Monitoring



MVP에서는 복잡한 Monitoring System을 구축하지 않는다.



최소한 다음을 확인할 수 있도록 한다.



\* Backend 오류 로그

\* 외부 API 호출 실패

\* AI 분석 실패

\* DB 오류

\* 요청 처리 시간



향후 서비스 규모가 커질 경우 별도의 Observability Stack을 도입할 수 있다.



\---



\# 46. Deployment Architecture



MVP 배포 구조는 단순하게 유지한다.



```text

&#x20;                 Internet

&#x20;                    │

&#x20;         ┌──────────┴──────────┐

&#x20;         │                     │

&#x20;         ▼                     ▼

&#x20;    Frontend                Backend

&#x20;                              │

&#x20;                   ┌──────────┴──────────┐

&#x20;                   ▼                     ▼

&#x20;               PostgreSQL           External APIs

&#x20;                                         │

&#x20;                                         └── LLM API

```



Docker를 사용해 개발 환경을 통일한다.



\---



\# 47. Docker Development Environment



개발 환경 예시:



```text

Docker Compose



├── frontend

├── backend

└── postgres

```



외부 LLM과 채용 API는 외부 서비스이므로 Compose 내부에 포함하지 않는다.



\---



\# 48. MVP Architecture Scope



MVP에서는 다음 구조만 구현한다.



```text

React

&#x20; ↓

Spring Boot

&#x20; ├── Spring Security

&#x20; ├── Spring Data JPA

&#x20; ├── Spring AI

&#x20; └── REST API

&#x20;      ↓

PostgreSQL



Spring Boot

&#x20; ├── Work24 API

&#x20; └── External LLM API

```



\---



\# 49. Explicitly Excluded from MVP



다음 기술은 MVP에서 사용하지 않는다.



\### Infrastructure



\* Kubernetes

\* Kafka

\* Redis

\* Service Mesh



\### Architecture



\* Microservices

\* Event-driven distributed architecture



\### AI



\* 별도 FastAPI AI 서버

\* 자체 LLM 학습

\* GPU inference

\* RAG

\* Vector Database

\* LangChain

\* LangGraph

\* MCP

\* Agent 시스템

\* 복잡한 Recommendation Model



\### Product



\* 합격 확률 예측

\* 소셜 로그인

\* 결제

\* 모바일 앱

\* 관리자 시스템

\* 실시간 알림 시스템



필요성이 실제로 발생한 경우 후속 버전에서 도입 여부를 판단한다.



\---



\# 50. Future Expansion



\## Phase 2



필요할 경우 다음을 검토한다.



```text

FastAPI

&#x20;  ↓

Python Model

```



도입 대상:



\* Hugging Face Model

\* Reranker

\* Embedding

\* NLP Model

\* 자체 ML Model



\---



\## Phase 3



데이터 규모가 증가할 경우:



\* Redis

\* Background Job

\* Message Queue

\* Batch Processing

\* Search Engine

\* Vector Search



등을 검토할 수 있다.



단, 실제 병목이나 요구사항이 확인된 후 도입한다.



\---



\# 51. Architecture Decision Summary



| 결정             | 선택               | 이유                          |

| -------------- | ---------------- | --------------------------- |

| Backend        | Spring Boot      | CRM 및 비즈니스 로직 중심            |

| Architecture   | Modular Monolith | MVP 복잡도와 확장성 균형             |

| Database       | PostgreSQL       | 관계형 데이터와 분석 쿼리에 적합          |

| ORM            | Spring Data JPA  | Spring 기반 CRUD 및 도메인 모델링    |

| AI             | Spring AI        | 현재 AI 요구사항이 LLM 기반 구조화이기 때문 |

| AI Server      | 없음               | 별도 Python 모델이 현재 필요하지 않음    |

| Job API        | Adapter          | 외부 API별 데이터 구조 차이 대응        |

| Skill          | 표준 Skill + Alias | 기술명 정규화                     |

| API            | REST             | Frontend / Backend 분리       |

| Infrastructure | Docker           | 개발 및 배포 환경 일관성              |

| Microservice   | 사용하지 않음          | 현재 규모에 비해 복잡도가 높음           |

| Vector DB      | 사용하지 않음          | MVP에서 의미 검색이 핵심 요구사항이 아님    |

| Agent          | 사용하지 않음          | 제품 핵심 기능이 아님                |



\---



\# 52. Core Architecture Principle



DevJob의 핵심 아키텍처는 다음과 같이 요약한다.



```text

&#x20;                   DEVJOB

&#x20;                      │

&#x20;       ┌──────────────┼──────────────┐

&#x20;       │              │              │

&#x20;     CRM           Job Data          AI

&#x20;       │              │              │

&#x20;       ▼              ▼              ▼

&#x20;    Spring Boot   Adapter Layer   Spring AI

&#x20;       │              │              │

&#x20;       └──────────────┼──────────────┘

&#x20;                      │

&#x20;                      ▼

&#x20;                 PostgreSQL

```



핵심 원칙은 다음과 같다.



> \*\*CRM은 Spring Boot를 중심으로 단순하고 안정적으로 구성하고, 외부 채용 데이터와 LLM은 Adapter/AI Layer를 통해 분리한다.\*\*



> \*\*AI가 핵심 기능을 강화하지만 AI 장애가 CRM 전체 장애로 이어지지 않도록 설계한다.\*\*



> \*\*현재 필요한 복잡성만 구현하고, 실제 요구사항과 병목이 발생했을 때 확장한다.\*\*



