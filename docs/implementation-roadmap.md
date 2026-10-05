# DevJob MVP 구현 로드맵

## 사용 방법

2026-10-05 기준 main에는 **S01·S02가 구현·검증 완료** 상태로 통합되어 있다. S01은 Backend 빌드·기본 테스트·기동, PostgreSQL Compose·연결, 공통 오류 응답을 검증했다. S02는 Frontend 빌드·공통 API 클라이언트 테스트·기본 화면과 상태 표시를 검증했으며, 픽셀 아트 공통 디자인은 S02-V에서 진행한다. 나머지 단계의 통합 여부는 작업을 시작할 때 Git 상태로 확인한다. 한 단계의 선행 작업을 마치면 그 단계만 구현·검증한다. 독립적인 단계는 동시에 진행할 수 있다.

각 단계에 적힌 관련 문서만 우선 확인한다. 공통 규칙은 [AGENTS.md](../AGENTS.md), 복잡한 작업의 실행계획 기준은 [.agent/PLANS.md](../.agent/PLANS.md)를 따른다. DB·API 계약은 [ERD](erd.md)와 [API 명세](api-spec.md)가 기준이다. 모든 API는 현재 **설계 예정**이다.

## 단계·의존성·권장 모델

선행 단계가 모두 끝나야 착수한다. 모델은 **Codex 구현 작업 권장값**이며 DevJob 서비스가 호출할 LLM과 별개다.

| 단계 | 구현 단위 | 선행 | 권장 모델 · reasoning |
| --- | --- | --- | --- |
| S01 | Backend·PostgreSQL 공통 기반 | 없음 | GPT-6.1 Sol · medium |
| S02 | React 공통 기반 | 없음 | GPT-6.1 Sol · medium |
| S02-V | 픽셀 아트 공통 디자인 | S02 | GPT-6.1 Sol · medium |
| S03 | 계정·인증 | S01, S02 | GPT-6.1 Sol · high |
| S04 | 프로필 | S02-V, S03 | GPT-6.1 Sol · medium |
| S05 | 기술 목록·정규화 | S02-V, S03 | GPT-6.1 Sol · high |
| S06 | 프로젝트 관리 | S02-V, S05 | GPT-6.1 Sol · medium |
| S07 | 채용공고 Adapter·모의 수집 | S01 | GPT-6.1 Sol · high |
| S08 | 공고 검색·상세 | S02-V, S03, S07 | GPT-6.1 Sol · medium |
| S09 | Work24 실제 연동 | S07 | GPT-6.1 Sol · high |
| S10 | 북마크 | S02-V, S08 | GPT-6.1 Sol · medium |
| S11 | 지원·상태 이력 | S02-V, S08 | GPT-6.1 Sol · high |
| S12 | AI 공고 분석 | S07, S10, S11 | GPT-6 Astra · high |
| S13 | 공고별 역량 비교 | S02-V, S05, S06, S08, S12 | GPT-6.1 Sol · high |
| S14 | 시장 기술 수요 | S02-V, S07, S12 | GPT-6.1 Sol · medium |
| S15 | Skill Gap·학습 우선순위 | S02-V, S04, S13, S14 | GPT-6.1 Sol · high |
| S16 | 대시보드 | S02-V, S10, S11, S13, S15 | GPT-6.1 Sol · medium |
| S17 | MVP 통합·배포 검증 | S09, S16 | GPT-6 Astra · high |

### 병렬 작업

- 시작: **S01 ∥ S02**.
- S02 후 S02-V, S01·S02 후 S03, S01 후 S07을 시작할 수 있다. 이 세 작업은 병렬로 가능하다. S03 인증 화면은 병합 순서와 관계없이 S02-V의 공통 시각 기준으로 최종 확인한다. 같은 Frontend 파일을 동시에 수정하지 않도록 작업 영역과 통합 순서를 조정한다. S07 후 S09도 별도로 진행할 수 있다.
- S02-V·S03 후: **S04 ∥ S05**. S05 후 S06을 진행한다.
- S08 후: **S10 ∥ S11**. 공고 상세 화면을 함께 수정할 때는 담당 영역이나 병합 순서를 정한다.
- S12 후: **S13 ∥ S14**. S13에는 S06 완료도 필요하다.
- 합류: **S15 → S16 → S17**. S09는 S17 전에 완료하면 된다.

## 단계별 구현 요구사항

### 공통 기반

**S01 · Backend·PostgreSQL 공통 기반**
- 문서: [architecture](architecture.md), [ERD](erd.md), [API](api-spec.md).
- 구현: 문서의 Spring Boot·Gradle·PostgreSQL·Docker Compose 개발 환경을 구성한다. Controller → Service → Repository 구조, 공통 입력 검증·오류 응답과 DB 연결을 마련한다. 스키마 적용은 확정된 Flyway SQL migration + JPA `validate`를 사용한다.
- 완료: Backend Compile·기본 테스트·기동, DB 연결과 오류 응답 확인.

**S02 · React 공통 기반**
- 문서: [architecture](architecture.md), [UI](ui-spec.md), [API](api-spec.md).
- 구현: React 실행 환경, 화면 이동, 공통 레이아웃, API 호출 기반과 로딩·빈 화면·오류 상태를 마련한다. Frontend 언어와 인증 전달 방식은 확정된 계약을 따른다.
- 완료: Frontend Build, 기본 화면·공통 상태 표시 확인.

**S02-V · 픽셀 아트 공통 디자인**
- 문서: [requirements](requirements.md), [UI](ui-spec.md). 기존 Frontend의 공통 레이아웃·상태 컴포넌트를 확인한다.
- 구현: 현대적인 SaaS 레이아웃과 가독성을 유지하면서 공통 색상·아이콘·배지·빈 상태·성공 상태에 절제된 픽셀 아트 아이덴티티를 적용하고 기본 캐릭터 표시를 마련한다. 이미 구현된 인증 화면이 있다면 공통 스타일과 맞춘다. 캐릭터 성장·꾸미기, 복잡한 게이미피케이션은 포함하지 않는다.
- 완료: 기본 화면과 공통 상태에서 픽셀 아트 요소가 실제로 보이고, Desktop·Tablet·Mobile에서 가독성·상태 식별을 확인하며 Frontend Build를 통과한다. 이후 기능 화면에 재사용할 수 있는 공통 기준을 남긴다.

### 계정과 사용자 데이터

**S03 · 계정·인증**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: User 저장·이메일 중복 방지, 회원가입·로그인·로그아웃·현재 사용자 API, 보호된 경로와 인증 화면을 구현한다. 비밀번호 저장과 사용자별 접근을 검증한다.
- 완료: 인증·미인증·중복 가입 테스트, Backend Compile·Frontend Build, 가입→로그인→로그아웃 확인.

**S04 · 프로필**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 사용자별 Profile 조회·저장 API와 첫 설정·수정 화면을 연결한다. 이메일은 User에만 저장하고 소유권을 확인한다.
- 완료: 신규/기존 프로필·타인 접근 테스트, Build와 저장 후 재조회 확인.

**S05 · 기술 목록·정규화**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: Skill·SkillAlias·UserSkill, 표준 기술 검색·별칭 정규화·내 기술 추가/삭제 API와 프로필 기술 UI를 구현한다.
- 완료: 중복·별칭·소유권·없는 기술 테스트, Build와 화면 추가/삭제 확인.

**S06 · 프로젝트 관리**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: Project·ProjectSkill 관계와 내 프로젝트 CRUD API·화면을 구현한다. 프로젝트 기술은 사용자 기술 목록과 독립적으로 관리한다.
- 완료: CRUD·기술 관계·타인 접근 테스트, Build와 등록→수정→삭제 확인.

### 채용공고

**S07 · 채용공고 Adapter·모의 수집**
- 문서: [architecture](architecture.md), [requirements](requirements.md), [ERD](erd.md), [user flow](user-flow.md).
- 구현: JobSourceAdapter 계약, Company·JobSource·JobPosting 저장, 외부 응답 정규화·중복 처리·실패 격리를 만든다. 모의 응답으로 검증하며 공개 수집 API는 추가하지 않는다.
- 완료: 중복 키·회사 연결·누락 필드·외부 실패 테스트와 Backend Compile.

**S08 · 공고 검색·상세**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 저장된 공고의 목록·검색·기본 필터·상세 API와 화면을 연결한다. AI 기술·적합도·지원 상태에 의존하는 필터와 표시는 S11~S13에서 완성한다. 분석이 없어도 공고 원문은 볼 수 있어야 한다.
- 완료: 검색·페이지·기본 필터·없는 공고 테스트, Build와 목록→상세 흐름 확인.

**S09 · Work24 실제 연동**
- 문서: [architecture](architecture.md), [requirements](requirements.md), [ERD](erd.md).
- 구현: 공식 접근 조건과 제공 필드를 확인한 뒤 Work24Adapter를 S07의 계약에 연결한다. 자격 정보는 환경에서 주입하고 실패 시 저장된 공고 조회를 유지한다.
- 완료: 모의 응답 회귀 테스트, 가능한 범위의 실제 연동, 중복 수집·장애 격리 확인.

### 기본 CRM

**S10 · 북마크**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 사용자·공고 북마크 목록·추가·삭제 API와 공고 화면의 저장/해제를 연결한다. 같은 공고의 중복 저장을 막는다.
- 완료: 중복·타인 데이터 분리 테스트, Build와 저장→목록→해제 확인.

**S11 · 지원·상태 이력**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: Application 등록·조회·메모/일정 수정, 허용된 상태 전이, 모든 상태 변경의 이력 저장과 지원 관리 화면을 구현한다. 공고의 사용자별 지원 상태도 연결한다.
- 완료: 최초 이력·전이·중복·소유권 테스트, Build와 등록→상태 변경→이력 조회 확인.

### AI와 분석

**S12 · AI 공고 분석**
- 문서: [architecture](architecture.md), [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [user flow](user-flow.md).
- 구현: 공고별 AIAnalysis 요청·상태·결과 API를 구현한다. LLM 출력 검증, 기술 정규화, 결과 저장·재사용, 실패·재시도를 처리한다. 제공자와 처리 방식은 착수 전에 확정한다.
- 완료: 유효/무효 출력·중복 요청·실패/재시도 테스트와 Build, 실패 시 공고 조회·CRM 유지 확인.

**S13 · 공고별 역량 비교**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: UserSkill과 ProjectSkill을 합쳐 분석된 공고 기술과 비교한다. 일치·부족 기술, 규칙 기반 적합도, 데이터 부족 응답을 만들고 공고 화면에 표시한다. 목록의 기술·최소 적합도 필터와 적합도 정렬을 완성한다.
- 완료: 계산 경계·기술 중복·분석 미완료 테스트, Build와 비교 화면 확인.

**S14 · 시장 기술 수요**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 완료된 분석 공고에서 기술 수요를 집계하고 기간·직무 필터와 표본 수를 제공한다. 시장 분석 화면을 연결한다. 별도 통계 저장 테이블은 만들지 않는다.
- 완료: 집계·필터·빈 결과 테스트, Build와 수요 화면 확인.

**S15 · Skill Gap·학습 우선순위**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 사용자·프로젝트 기술과 목표 직무의 시장 수요를 비교한다. 기본 규칙으로 부족 기술과 HIGH/MEDIUM/LOW 우선순위를 산출하고 역량 분석 화면을 연결한다. 기준은 착수 전에 확정한다.
- 완료: 기술·공고 데이터 부족과 우선순위 계산 테스트, Build와 화면 확인.

**S16 · 대시보드**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 지원·북마크·적합도·Skill Gap 데이터에서 현황, 다음 행동, 기본 추천 공고와 역량 미리보기를 조합한다. 별도 할 일 기능은 만들지 않는다.
- 완료: 집계·빈 데이터·사용자 분리 테스트, Build와 관련 화면 이동 확인.

### 통합

**S17 · MVP 통합·배포 검증**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [architecture](architecture.md), [API](api-spec.md), [development plan](development-plan.md).
- 구현: 가입→프로필/기술/프로젝트→공고→북마크/지원→AI→역량·시장 분석→대시보드 흐름을 점검한다. Work24·LLM 장애, Secret 관리, 문서·구현 계약과 개발 환경 재현성을 확인한다. 실제 배포 대상은 결정된 경우에만 검증한다.
- 완료: Backend/Frontend Build, 관련 자동 테스트·핵심 흐름·장애 회귀, 문서 정합성 점검.

## 착수 전 확인이 필요한 결정

해당 단계의 계약에 영향을 줄 때 확정한다. 다른 독립 단계는 계속 진행할 수 있다.

| 결정 | 필요한 단계 |
| --- | --- |
| PostgreSQL 스키마 적용·변경 방식: Flyway SQL migration + JPA `validate`로 확정. S01에서는 도메인 migration을 만들지 않는다. | S01, 첫 Entity 작업 |
| React 프로젝트 언어: TypeScript로 확정 | S02 |
| 인증 전달·로그아웃 방식, 회원가입 화면 최소 구성 | S03 |
| 프로젝트 관리 화면 최소 구성 | S06 |
| Work24 공식 접근 권한·필드·이용 조건 | S09 |
| LLM 제공자·자격 정보·비용 범위와 202/PENDING 처리 방식 | S12 |
| Skill Gap 우선순위 구간 | S15 |
| 대시보드 추천·다음 행동 선정 기준 | S16 |
| 실제 배포 대상·운영 설정 범위 | S17 |

## 단계 완료 규칙과 제외 범위

- 각 단계는 관련 문서·기존 구현 확인 → Backend 구현·테스트 → 필요한 Frontend 연결·Build → 화면/계약 통합 확인 순으로 마친다. API·DB 계약 변경은 api-spec.md·erd.md와 동기화한다.
- 병렬 작업은 소유 파일과 공통 계약을 먼저 나눈다. 공통 파일 또는 계약을 함께 바꿔야 하면 한 작업에서 먼저 확정한다.
- 이력서·자기소개서 분석, 알림, 관리자 기능, 별도 할 일 관리, 확장형 캐릭터, 복잡한 추천, 추가 채용 출처는 **MVP 이후**다. 새 기술·라이브러리·외부 서비스를 이 로드맵만으로 추가하지 않는다.
