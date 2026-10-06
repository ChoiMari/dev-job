\# DevJob Development Plan



\## 1. 문서 목적



본 문서는 \*\*DevJob\*\*의 개발 순서와 단계별 구현 범위를 정의한다.



개발 과정에서 다음을 명확하게 하기 위한 문서이다.



\* 무엇을 먼저 개발할 것인가

\* 각 단계에서 어떤 기능을 완성할 것인가

\* 선행 작업과 의존성은 무엇인가

\* 각 단계의 완료 기준은 무엇인가

\* Coding Agent를 어떤 범위로 사용할 것인가

\* MVP 이후 어떤 기능을 확장할 것인가



\---



\# 2. Development Principles



DevJob은 다음 원칙으로 개발한다.



\## 2.1 문서 → 설계 → 구현



기능을 바로 Coding Agent에게 구현시키지 않는다.



```text

요구사항 확인

&#x20;   ↓

User Flow 확인

&#x20;   ↓

Architecture 확인

&#x20;   ↓

ERD 확인

&#x20;   ↓

API Spec 확인

&#x20;   ↓

구현

&#x20;   ↓

테스트

&#x20;   ↓

검증

```



\---



\## 2.2 작은 단위로 구현



한 번에 전체 서비스를 구현하지 않는다.



예:



```text

❌ "DevJob 전체를 구현해줘"



⭕ "User 도메인의 회원가입 API를 구현해줘"

⭕ "JobPosting Entity와 Repository를 구현해줘"

⭕ "Job 목록 조회 API를 구현해줘"

```



각 작업은 가능한 한 하나의 명확한 완료 조건을 가져야 한다.



\---



\## 2.3 Backend와 Frontend를 동시에 복잡하게 만들지 않는다



기본적으로 다음 순서를 따른다.



```text

Database

&#x20;  ↓

Backend API

&#x20;  ↓

API Test

&#x20;  ↓

Frontend

&#x20;  ↓

Integration Test

```



\---



\## 2.4 AI는 핵심 기반 기능 이후 구현



AI를 가장 먼저 붙이지 않는다.



먼저:



```text

JobPosting

Skill

UserSkill

```



등의 기본 데이터 구조를 만든다.



그 다음:



```text

JobPosting

&#x20;   ↓

AI Analysis

&#x20;   ↓

JobSkill

```



을 연결한다.



\---



\# 3. Overall Development Roadmap



DevJob 전체 개발 단계:



```text

Phase 0  프로젝트 초기 설정

&#x20;  ↓

Phase 1  DB / 공통 구조

&#x20;  ↓

Phase 2  사용자 / 프로필 / Skill

&#x20;  ↓

Phase 3  프로젝트 관리

&#x20;  ↓

Phase 4  채용공고 수집 / 정규화

&#x20;  ↓

Phase 5  채용공고 조회 / 검색

&#x20;  ↓

Phase 6  AI 채용공고 분석

&#x20;  ↓

Phase 7  역량 비교 / Skill Gap

&#x20;  ↓

Phase 8  관심공고 / 지원관리

&#x20;  ↓

Phase 9  Dashboard

&#x20;  ↓

Phase 10 채용시장 분석

&#x20;  ↓

Phase 11 Frontend 고도화

&#x20;  ↓

Phase 12 통합 테스트 / 배포

```



\---



\# 4. Phase 0 — Project Initialization



\## 목표



DevJob의 개발 환경과 Repository 기본 구조를 만든다.



\## 작업



\### Repository



\* Git Repository 생성

\* README 생성

\* `.gitignore`

\* 기본 Branch 정책

\* Commit 규칙



\### Backend



\* Spring Boot 프로젝트 생성

\* Gradle 설정

\* 기본 패키지 구조

\* 환경 설정



\### Frontend



\* React 프로젝트 생성

\* 기본 라우팅

\* 기본 폴더 구조



\### Database



\* PostgreSQL 실행

\* Docker Compose 구성

\* Backend ↔ PostgreSQL 연결



\---



\## 완료 기준



```text

\[ ] Git Repository 생성

\[ ] Spring Boot 실행 성공

\[ ] React 실행 성공

\[ ] PostgreSQL 실행 성공

\[ ] Spring Boot → PostgreSQL 연결 성공

\[ ] Docker Compose 실행 성공

```



\---



\# 5. Phase 1 — Database / Common Structure



\## 목표



DevJob의 기본 데이터 구조와 공통 Backend 구조를 만든다.



\## 주요 Domain



```text

User

Profile

Skill

SkillAlias

Project

ProjectSkill

Company

JobSource

JobPosting

JobSkill

Bookmark

Application

ApplicationStatusHistory

AIAnalysis

```



\---



\## 작업 순서



```text

User

&#x20;↓

Profile

&#x20;↓

Skill

&#x20;↓

Project

&#x20;↓

Company

&#x20;↓

JobSource

&#x20;↓

JobPosting

&#x20;↓

JobSkill

&#x20;↓

Bookmark

&#x20;↓

Application

&#x20;↓

ApplicationStatusHistory

&#x20;↓

AIAnalysis

```



모든 Entity를 한 번에 구현하지 않는다.



\---



\## 완료 기준



```text

\[ ] 핵심 Entity 설계 완료

\[ ] PK / FK 관계 확인

\[ ] JPA Entity 구현

\[ ] Migration 작성

\[ ] PostgreSQL에서 정상 생성 확인

\[ ] 기본 Repository 테스트

```



\---



\# 6. Phase 2 — User / Profile / Skill



\## 목표



사용자가 자신의 취업 정보를 관리할 수 있도록 한다.



\## 기능



\### 회원



\* 회원가입

\* 로그인

\* 로그아웃

\* 인증



\### Profile



\* 프로필 조회

\* 프로필 수정



\### Skill



\* Skill 조회

\* 사용자 Skill 등록

\* 사용자 Skill 삭제

\* Skill Alias 관리



\---



\## 개발 순서



```text

User

&#x20;↓

Authentication

&#x20;↓

Profile

&#x20;↓

Skill

&#x20;↓

UserSkill

```



\---



\## 완료 기준



```text

\[ ] 회원가입 가능

\[ ] 로그인 가능

\[ ] 인증된 사용자만 개인 데이터 접근 가능

\[ ] Profile CRUD 가능

\[ ] Skill 등록 가능

\[ ] Skill 삭제 가능

\[ ] 다른 사용자의 데이터 접근 차단

```



\---



\# 7. Phase 3 — Project Management



\## 목표



사용자가 자신의 프로젝트 경험을 등록하고 관리할 수 있도록 한다.



\## 기능



\* 프로젝트 등록

\* 프로젝트 조회

\* 프로젝트 수정

\* 프로젝트 삭제

\* 프로젝트 Skill 연결



\---



\## Flow



```text

Project 생성

&#x20;   ↓

ProjectSkill 연결

&#x20;   ↓

User Skill 분석 데이터로 활용

```



\---



\## 완료 기준



```text

\[ ] Project CRUD

\[ ] ProjectSkill 연결

\[ ] 사용자별 프로젝트 분리

\[ ] 프로젝트에 사용 기술 표시

\[ ] GitHub / 배포 URL 저장 가능

```



\---



\# 8. Phase 4 — Job Data Collection



\## 목표



외부 채용 API에서 채용공고를 수집하고 DevJob의 표준 구조로 저장한다.



\---



\## 우선순위



1\. Work24 공채속보 목록 (S09 구현·검증 완료)

2\. 사람인 보완 연동은 사용자 요청에 따라 후속 검토한다. 별도 API 승인과 이용 조건 확인 후 구현 범위를 확정하며, 그 밖의 추가 채용 API는 이후 검토한다.



MVP에서는 실제 API 접근 권한과 제공 범위를 확인한 뒤 구현한다.



\---



\## Architecture



```text

JobSourceAdapter

&#x20;      ↓

Work24Adapter

&#x20;      ↓

External Job Data

&#x20;      ↓

Normalization

&#x20;      ↓

JobPosting

&#x20;      ↓

PostgreSQL

```



\---



\## 작업



\### 1. Adapter Interface



```text

JobSourceAdapter

```



\### 2. External DTO



외부 API 응답을 내부 Entity와 직접 연결하지 않는다.



```text

External API DTO

&#x20;      ↓

Normalization

&#x20;      ↓

Domain Entity

```



\### 3. 중복 처리



```text

Source + External Job ID

```



를 우선적인 식별 기준으로 사용한다.



\---



\## 완료 기준



```text

\[ ] 외부 API 호출 성공

\[ ] 외부 DTO 변환 성공

\[ ] JobPosting 저장 성공

\[ ] Company 연결

\[ ] JobSource 연결

\[ ] 중복 공고 처리

\[ ] API 오류 처리

```



\---



\# 9. Phase 5 — Job List / Search / Detail



\## 목표



사용자가 실제로 채용공고를 탐색할 수 있도록 한다.



\## 기능



\* 채용공고 목록

\* 검색

\* 필터

\* 정렬

\* 상세 조회

\* 회사 정보

\* 기술 정보

\* 원문 확인



\---



\## 개발 순서



```text

Job List API

&#x20;   ↓

Job Detail API

&#x20;   ↓

Search

&#x20;   ↓

Filter

&#x20;   ↓

Sort

```



\---



\## 기본 검색 조건



\* 키워드

\* 회사

\* 기술

\* 지역

\* 경력

\* 고용 형태

\* 마감일



\---



\## 완료 기준



```text

\[ ] 목록 조회

\[ ] 상세 조회

\[ ] Pagination

\[ ] 검색

\[ ] 기본 Filter

\[ ] Sort

\[ ] 만료 공고 처리

```



\---



\# 10. Phase 6 — AI Job Analysis



\## 목표



비정형 채용공고 텍스트에서 구조화된 기술 요구사항을 추출한다.



\---



\## AI Flow



```text

JobPosting

&#x20;   ↓

AI Analysis Service

&#x20;   ↓

Spring AI

&#x20;   ↓

External LLM

&#x20;   ↓

Structured Output

&#x20;   ↓

Validation

&#x20;   ↓

Skill Normalization

&#x20;   ↓

JobSkill

```



\---



\## 분석 결과



최소한 다음을 추출한다.



```text

REQUIRED

\- Java

\- Spring Boot

\- PostgreSQL



PREFERRED

\- Docker

\- AWS

```



\---



\## AI 상태



```text

PENDING

COMPLETED

FAILED

```



\---



\## 작업 순서



\### 1. AI DTO 정의



LLM이 반환해야 할 구조를 먼저 정의한다.



\### 2. Prompt 작성



채용공고 분석 목적과 출력 Schema를 명확하게 정의한다.



\### 3. Spring AI 연동



External LLM API를 연결한다.



\### 4. Structured Output 검증



LLM 결과를 검증한다.



\### 5. Skill Normalization



```text

Postgres

&#x20;   ↓

PostgreSQL

```



등을 표준 Skill로 연결한다.



\### 6. DB 저장



AI 분석 결과 및 JobSkill을 저장한다.



\---



\## 완료 기준



```text

\[ ] LLM API 연결

\[ ] 구조화된 JSON 응답

\[ ] Schema Validation

\[ ] REQUIRED / PREFERRED 구분

\[ ] Skill Normalization

\[ ] 분석 결과 DB 저장

\[ ] 분석 결과 재사용

\[ ] AI 실패 처리

\[ ] 재분석 가능

```



\---



\# 11. Phase 7 — User ↔ Job Matching



\## 목표



사용자의 역량과 채용공고의 요구사항을 비교한다.



\---



\## Matching Flow



```text

UserSkill

&#x20;   +

ProjectSkill

&#x20;   +

JobSkill

&#x20;   ↓

Skill Normalization

&#x20;   ↓

Matching

&#x20;   ↓

Match Result

```



\---



\## 제공 정보



```text

필수 기술

✓ Java

✓ Spring Boot

✓ PostgreSQL

✕ AWS



우대 기술

✓ Docker

✕ Redis

```



\---



\## MVP Matching



MVP에서는 복잡한 Machine Learning 기반 점수를 사용하지 않는다.



기본적인:



\* 일치

\* 부족

\* 필수

\* 우대



정보를 제공한다.



\---



\## 완료 기준



```text

\[ ] User Skill 조회

\[ ] Project Skill 반영

\[ ] Job Skill 비교

\[ ] 일치 Skill 계산

\[ ] Missing Skill 계산

\[ ] Required / Preferred 구분

```



\---



\# 12. Phase 8 — Bookmark / Application Management



\## 목표



사용자가 관심 공고와 실제 지원 과정을 관리할 수 있도록 한다.



\---



\## Bookmark



```text

JobPosting

&#x20;   ↓

Bookmark

&#x20;   ↓

User

```



기능:



\* 저장

\* 저장 취소

\* 저장 목록 조회



\---



\## Application



상태:



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



\---



\## 상태 변경



```text

Application

&#x20;    ↓

Status 변경

&#x20;    ↓

ApplicationStatusHistory

```



\---



\## 완료 기준



```text

\[ ] 관심 공고 저장

\[ ] 관심 공고 조회

\[ ] 지원 예정 등록

\[ ] 지원 완료 등록

\[ ] 상태 변경

\[ ] 상태 이력 저장

\[ ] 지원 메모

\[ ] 면접 일정

\[ ] 최종 결과

```



\---



\# 13. Phase 9 — Dashboard



\## 목표



여러 도메인의 정보를 하나의 화면에서 확인한다.



\---



\## Dashboard Data



```text

Application

&#x20;   ↓

지원 통계



Bookmark

&#x20;   ↓

관심 공고



JobPosting

&#x20;   ↓

추천 / 최근 공고



UserSkill + JobSkill

&#x20;   ↓

Skill Gap

```



\---



\## Dashboard 구성



\### 주요 지표



\* 지원 예정

\* 지원 완료

\* 면접 예정

\* 관심 공고



\### 오늘의 할 일



\* 지원

\* 공고 확인

\* 학습

\* 일정



\### 추천 채용공고



\* 회사

\* 직무

\* 적합도

\* 마감일



\### 역량 현황



\* 강점

\* 부족 기술



\---



\## 완료 기준



```text

\[ ] Dashboard API

\[ ] 지원 통계 표시

\[ ] 관심 공고 표시

\[ ] 추천 공고 표시

\[ ] Skill Gap 표시

\[ ] 사용자별 데이터 분리

```



\---



\# 14. Phase 10 — Market Analytics



\## 목표



수집한 채용공고를 기반으로 채용시장 기술 수요를 보여준다.



\---



\## Data Flow



```text

JobPosting

&#x20;   ↓

JobSkill

&#x20;   ↓

Skill

&#x20;   ↓

GROUP BY

&#x20;   ↓

Skill Demand

```



\---



\## 제공 정보



\* 기술별 채용공고 수

\* 직무별 기술 수요

\* 경력별 기술 수요

\* 지역별 채용 분포

\* 기간별 기술 수요



\---



\## MVP



PostgreSQL 집계 쿼리를 사용한다.



별도의 데이터 분석 서버를 만들지 않는다.



\---



\## 완료 기준



```text

\[ ] Skill별 채용 수 집계

\[ ] 기간 필터

\[ ] 기본 직무 필터

\[ ] Dashboard / Analytics API

\[ ] Frontend 차트 표시

```



\---



\# 15. Phase 11 — Skill Gap / Learning Priority

사용자·프로젝트 기술의 합집합과 목표 직무의 분석 완료 공고 기술을 비교한다. 부족 기술별 필수·우대 등장 건수를 집계하고 `100 × (필수 건수 + 0.5 × 우대 건수) ÷ 분석 완료 공고 수`로 정렬한다. 화면에는 점수 대신 상위 5개의 순위·기술명·등장률·필수/우대 실제 건수를 표시한다.

완료 분석 공고가 5건 미만이면 순위를 보류하고 5~19건이면 `표본 적음`을 표시한다. 20건 이상은 일반 표시한다. 기술·공고·공고 기술 부족과 이미 모든 기술을 보유한 경우를 구분한다. 계산 결과는 저장하지 않으며 AI 추천 모델과 HIGH/MEDIUM/LOW 등급을 사용하지 않는다.

완료 기준: 부족 기술·필수/우대 집계·점수 정렬·데이터 부족 응답, API와 화면, 관련 테스트 및 빌드 확인.

---

\# 16. Phase 12 — Frontend Implementation



Backend의 핵심 API가 안정화된 이후 UI를 본격적으로 구현한다.



\---



\## 구현 순서



```text

Login

&#x20;↓

Dashboard

&#x20;↓

Job List

&#x20;↓

Job Detail

&#x20;↓

Application

&#x20;↓

Profile

&#x20;↓

Project

&#x20;↓

Skill Analysis

&#x20;↓

Market Analytics

&#x20;↓

Character

```



\---



\## Frontend 문서



Frontend Agent는 다음 문서를 기준으로 구현한다.



```text

requirements.md

user-flow.md

ui-spec.md

api-spec.md

```



\---



\# 17. UI Implementation Order



\## Step 1. Layout



먼저 다음을 구현한다.



\* Sidebar

\* Header

\* Page Container

\* Routing



\---



\## Step 2. Common Components



```text

Button

Card

Badge

Input

Select

Modal

Table

Pagination

EmptyState

Loading

ErrorState

```



\---



\## Step 3. Core Pages



```text

Login

Dashboard

Job List

Job Detail

Application Management

```



\---



\## Step 4. Management Pages



```text

Profile

Project

Skill Analysis

Market Analytics

```



\---



\## Step 5. Pixel / Gamification



마지막에 적용한다.



```text

Character

EXP

Level

Pixel Badge

Empty State Character

Success Animation

```



기능 구현보다 먼저 캐릭터 시스템을 만드는 것은 피한다.



\---



\# 18. Phase 13 — Integration



\## 목표



Frontend와 Backend를 실제 API로 연결한다.



\---



\## Integration Flow



```text

React

&#x20;  ↓

REST API

&#x20;  ↓

Spring Boot

&#x20;  ↓

Service

&#x20;  ↓

PostgreSQL

```



\---



\## 검증 항목



```text

\[ ] 로그인

\[ ] 프로필 조회

\[ ] Skill 등록

\[ ] Project 등록

\[ ] Job 조회

\[ ] Job 검색

\[ ] AI 분석

\[ ] Skill 비교

\[ ] Bookmark

\[ ] Application

\[ ] Dashboard

\[ ] Analytics

```



\---



\# 19. Phase 14 — Testing



테스트는 마지막에 한 번에 하는 것이 아니라 각 Phase에서 함께 작성한다.



\---



\## Backend Test



\### Unit Test



\* Service

\* Domain logic

\* Matching logic

\* Skill normalization



\### Integration Test



\* Repository

\* Database

\* API

\* Authentication



\---



\## 주요 테스트



```text

회원가입

로그인

권한 검증

Job 검색

Job 상세

AI 분석

AI 실패

Skill normalization

Skill matching

Bookmark

Application 상태 변경

Dashboard

Analytics

```



\---



\# 20. AI Testing



AI는 단순히 "응답이 왔다"만 테스트하지 않는다.



\## 테스트 데이터



다양한 채용공고를 준비한다.



```text

Case A

필수 / 우대 기술이 명확한 공고



Case B

자연어로 기술이 표현된 공고



Case C

기술명이 다양한 형태로 표현된 공고



Case D

기술 요구사항이 거의 없는 공고



Case E

LLM 응답이 예상 Schema와 다른 경우

```



\---



\## AI 평가 항목



```text

Required Skill 추출 정확성

Preferred Skill 추출 정확성

Skill Normalization 정확성

Invalid Output 처리

응답 시간

LLM 호출 비용

```



\---



\# 21. External API Testing



외부 채용 API에 항상 의존하여 테스트하지 않는다.



개발 환경에서는 필요한 경우 Mock 데이터를 사용할 수 있다.



```text

External API

&#x20;    ↓

Adapter

&#x20;    ↓

Mock / Real API

```



목적:



\* 테스트 안정성

\* API 호출 제한 회피

\* 빠른 개발

\* 외부 API 장애와 내부 로직 분리



\---



\# 22. Error Handling Testing



각 외부 의존성이 실패해도 서비스가 필요한 범위에서 동작하는지 확인한다.



\### Job API 실패



```text

Job API 실패

&#x20;↓

기존 Job 데이터 조회 가능

```



\### LLM 실패



```text

LLM 실패

&#x20;↓

Job Detail 정상 조회

&#x20;↓

AI 분석만 FAILED

```



\### Database 오류



```text

DB 오류

&#x20;↓

명확한 서버 오류 처리

&#x20;↓

민감한 DB 정보 노출 금지

```



\---



\# 23. Phase 15 — Deployment



\## 목표



실제 외부 환경에서 DevJob을 실행한다.



\---



\## 기본 구조



```text

Internet

&#x20;  ↓

Frontend

&#x20;  ↓

Spring Boot

&#x20;  ↓

PostgreSQL



Spring Boot

&#x20;  ├── Job API

&#x20;  └── LLM API

```



Docker 기반으로 배포 환경을 구성한다.



\---



\## 배포 전 확인



```text

\[ ] 환경변수 분리

\[ ] Secret 제거

\[ ] DB Migration

\[ ] CORS 설정

\[ ] API URL 설정

\[ ] Error Handling

\[ ] Logging

\[ ] Health Check

\[ ] Production Build

```



\---



\# 24. MVP Definition



DevJob MVP는 다음 흐름이 끝까지 동작하면 완료된 것으로 본다.



```text

회원가입

&#x20;  ↓

프로필 등록

&#x20;  ↓

기술 등록

&#x20;  ↓

채용공고 수집

&#x20;  ↓

채용공고 검색

&#x20;  ↓

채용공고 상세

&#x20;  ↓

AI 분석

&#x20;  ↓

필수 / 우대 기술 추출

&#x20;  ↓

내 역량 비교

&#x20;  ↓

부족 기술 확인

&#x20;  ↓

관심 공고 저장

&#x20;  ↓

지원 예정

&#x20;  ↓

지원 완료

&#x20;  ↓

지원 상태 관리

&#x20;  ↓

Dashboard 확인

```



추가적으로:



```text

JobPosting

&#x20;  ↓

Skill 집계

&#x20;  ↓

채용시장 분석

&#x20;  ↓

Skill Gap

&#x20;  ↓

학습 우선순위

```



까지 동작하면 핵심 차별 기능까지 완성된 것으로 본다.



\---



\# 25. MVP 제외 기능



개발 기간과 복잡도를 고려하여 다음 기능은 MVP에서 제외한다.



\## Infrastructure



\* Kubernetes

\* Kafka

\* Redis

\* Microservices



\## AI



\* 자체 LLM 학습

\* GPU inference

\* RAG

\* Vector Database

\* Embedding Search

\* Reranker

\* Agent

\* MCP

\* LangGraph

\* 복잡한 추천 모델



\## Product



\* 합격 확률 예측

\* 소셜 로그인

\* 결제

\* 모바일 앱

\* 관리자 페이지

\* 실시간 알림

\* 이메일 자동 발송

\* 카카오 알림



\---



\# 26. Coding Agent Development Strategy



DevJob은 Coding Agent를 활용해 개발할 수 있지만, 전체 프로젝트를 한 번에 맡기지 않는다.



\## Agent 작업 단위



하나의 작업은 다음 형식으로 정의한다.



```text

목표:

무엇을 구현하는가?



참고 문서:

어떤 문서를 읽어야 하는가?



수정 범위:

어떤 파일 / 모듈을 수정하는가?



구현 조건:

무엇을 지켜야 하는가?



검증:

어떤 테스트를 통과해야 하는가?



완료 조건:

무엇이 되면 완료인가?

```



\---



\# 27. Agent Implementation Cycle



각 기능은 다음 Cycle로 개발한다.



```text

문서 확인

&#x20;  ↓

구현 계획

&#x20;  ↓

사용자 확인

&#x20;  ↓

작은 범위 구현

&#x20;  ↓

테스트

&#x20;  ↓

결과 확인

&#x20;  ↓

문서 / 코드 정합성 확인

```



\---



\# 28. Recommended Agent Task Size



\### 너무 큰 작업



```text

❌ DevJob Backend 전체 구현

```



\### 적절한 작업



```text

⭕ User Entity + Repository + Service 구현

⭕ 회원가입 API 구현

⭕ 로그인 API 구현

⭕ JobPosting Entity 구현

⭕ Work24 Adapter 구현

⭕ Job 목록 조회 API 구현

⭕ AI Analysis Service 구현

```



\---



\# 29. Agent 작업 순서 예시



실제 개발에서는 다음과 같이 작업한다.



```text

Task 01

프로젝트 초기화

&#x20;       ↓

Task 02

PostgreSQL 연결

&#x20;       ↓

Task 03

User Domain

&#x20;       ↓

Task 04

Authentication

&#x20;       ↓

Task 05

Profile / Skill

&#x20;       ↓

Task 06

Project

&#x20;       ↓

Task 07

Job Domain

&#x20;       ↓

Task 08

Job API Adapter

&#x20;       ↓

Task 09

Job Search

&#x20;       ↓

Task 10

AI Analysis

&#x20;       ↓

Task 11

Skill Matching

&#x20;       ↓

Task 12

Bookmark / Application

&#x20;       ↓

Task 13

Dashboard

&#x20;       ↓

Task 14

Analytics

&#x20;       ↓

Task 15

Frontend Integration

&#x20;       ↓

Task 16

Testing

&#x20;       ↓

Task 17

Deployment

```



\---



\# 30. Definition of Done



각 개발 작업은 단순히 코드가 작성되었다고 완료 처리하지 않는다.



다음 조건을 만족해야 한다.



```text

\[ ] 요구사항 확인

\[ ] 관련 문서 확인

\[ ] 구현 완료

\[ ] 컴파일 성공

\[ ] 테스트 통과

\[ ] API 동작 확인

\[ ] 기존 기능 Regression 확인

\[ ] 코드 변경 범위 확인

\[ ] 필요 시 문서 업데이트

```



\---



\# 31. Regression Check



새로운 기능을 추가할 때 기존 기능이 깨지지 않았는지 확인한다.



예:



```text

Job Search 구현

&#x20;     ↓

기존 Login Test

기존 Profile Test

기존 Skill Test

&#x20;     ↓

Regression 확인

```



\---



\# 32. Documentation Synchronization



코드와 문서가 서로 다른 상태가 되지 않도록 한다.



다음 변경이 발생하면 관련 문서를 확인한다.



\### Entity 변경



→ `erd.md`



\### API 변경



→ `api-spec.md`



\### 화면 변경



→ `ui-spec.md`



\### 사용자 흐름 변경



→ `user-flow.md`



\### 시스템 구조 변경



→ `architecture.md`



\### 기능 요구사항 변경



→ `requirements.md`



\---



\# 33. Final Development Order



DevJob 전체 개발 순서는 다음과 같이 요약한다.



```text

&#x20;                   DevJob

&#x20;                      │

&#x20;                      ▼

&#x20;             0. Project Setup

&#x20;                      │

&#x20;                      ▼

&#x20;             1. Database / Domain

&#x20;                      │

&#x20;                      ▼

&#x20;             2. User / Profile / Skill

&#x20;                      │

&#x20;                      ▼

&#x20;             3. Project Management

&#x20;                      │

&#x20;                      ▼

&#x20;             4. Job Data Collection

&#x20;                      │

&#x20;                      ▼

&#x20;             5. Job Search / Detail

&#x20;                      │

&#x20;                      ▼

&#x20;             6. AI Job Analysis

&#x20;                      │

&#x20;                      ▼

&#x20;             7. Skill Matching

&#x20;                      │

&#x20;                      ▼

&#x20;             8. Bookmark / Application

&#x20;                      │

&#x20;                      ▼

&#x20;             9. Dashboard

&#x20;                      │

&#x20;                      ▼

&#x20;            10. Market Analytics

&#x20;                      │

&#x20;                      ▼

&#x20;            11. Skill Gap / Learning

&#x20;                      │

&#x20;                      ▼

&#x20;            12. Frontend Polish

&#x20;                      │

&#x20;                      ▼

&#x20;            13. Integration Test

&#x20;                      │

&#x20;                      ▼

&#x20;            14. Deployment

```



\---



\# 34. Final Goal



DevJob의 최종 목표는 단순히 기능을 많이 구현하는 것이 아니다.



다음의 하나의 흐름을 실제 서비스 수준으로 연결하는 것이다.



```text

채용공고

&#x20;  ↓

외부 데이터 수집

&#x20;  ↓

데이터 표준화

&#x20;  ↓

AI 요구사항 추출

&#x20;  ↓

Skill 표준화

&#x20;  ↓

사용자 역량 비교

&#x20;  ↓

Skill Gap

&#x20;  ↓

지원 의사결정

&#x20;  ↓

지원 관리

&#x20;  ↓

채용시장 분석

&#x20;  ↓

학습 우선순위

```



이를 통해 DevJob은 다음 문제를 해결한다.



> \*\*"어디에 지원해야 하는지 모르겠다."\*\*



→ 채용공고 탐색 + 검색 + 필터



> \*\*"내가 이 공고에 부족한 게 뭔지 모르겠다."\*\*



→ AI 분석 + Skill Matching + Skill Gap



> \*\*"어디에 지원했는지 관리하기 어렵다."\*\*



→ Bookmark + Application Management



> \*\*"요즘 신입 개발자에게 어떤 기술이 많이 필요한지 모르겠다."\*\*



→ Market Analytics



> \*\*"그래서 뭘 먼저 공부해야 하는지 모르겠다."\*\*



→ Skill Gap + Learning Priority



