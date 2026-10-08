# DevJob ERD (설계 예정)

## 1. 범위와 설계 판단

이 문서는 `requirements.md`, `user-flow.md`, `ui-spec.md`, `architecture.md`, `development-plan.md`에 명시된 **MVP 데이터 구조의 설계안**이다. S03의 `User`, S04의 `Profile`, S05의 `Skill`·`SkillAlias`·`UserSkill`, S06의 `Project`·`ProjectSkill`, S07의 `Company`·`JobSource`·`JobPosting`, S10의 `Bookmark`, S11의 `Application`·`ApplicationStatusHistory`와 추가 개인 관심공고 `PersonalSavedJob`을 Entity와 migration으로 구현했다. DB는 `architecture.md`의 PostgreSQL을 전제로 한다.

S01에서 스키마 적용은 Flyway SQL migration + JPA `validate`로 확정했다. S01은 연결 기반과 Flyway 이력 테이블만 구성하며, 아래 도메인 테이블은 후속 단계에서 Entity와 migration을 함께 구현한다.

통합 migration 순서는 S03 `V1__create_users.sql` → S07 `V2__create_job_collection.sql` → S04 `V3__create_profiles.sql` → S05 `V4__create_skills.sql` → S06 `V5__create_projects.sql` → S10 `V6__create_bookmarks.sql` → S11 `V7__create_applications.sql`이다. 기존 개발 DB의 Flyway 이력은 비어 있고 S06·S10·S11의 tmpfs 검증 DB는 재기동 후 이력 테이블이 없는 상태였다. S05 격리 DB에는 기술 생성이 V3으로 이미 적용되어 있으므로 통합본을 그대로 실행하면 Flyway 검증이 실패한다. 각 DB의 이력을 확인하고 이력 수정·DB 초기화를 자동으로 수행하지 않는다.

S07에서 `Company`·`JobSource`·`JobPosting`의 Entity·Repository를 구현했다. 아래 필드·관계·유일 키 계약을 유지하며 PostgreSQL 17에서 Flyway 적용과 JPA `validate`를 확인했다. 출처·외부 ID 중복은 기존 공고와 회사 연결을 보존한다. 신규 공고는 회사 고유 식별 근거가 없으므로 별도 Company를 연결하고 회사명만으로 기존 기업을 합치지 않는다. AI·CRM 테이블은 이 단계에 포함하지 않는다.

S09는 기존 스키마를 재사용한다. 공채속보의 JobSource.code는 `WORK24_OPEN_RECRUITMENT`, external_id는 공식 `empSeqno`다. 회사·제목·원문 URL과 고용형태 표시값만 목록에서 매핑하며 본문·경력·지역·게시일·마감일은 null이다. 일반 채용정보 출처와 ID 공간을 합치지 않는다. 새 migration 없이 반복·동시 수집과 외부 장애 격리를 일회용 PostgreSQL에서 검증했다.

S11 단독 worktree는 당시 V1~V4 뒤에 V5 지원 migration을 적용해 검증했다. main 통합에서는 프로젝트 V5·북마크 V6 다음의 V7로 배치했다. 기존 개발 DB에는 적용하지 않았다.

| 판단 지점 | MVP 결정과 근거 |
| --- | --- |
| 사용자와 프로필 | `User`에는 인증용 이메일과 비밀번호 해시를, `Profile`에는 취업 정보를 둔다. 이메일을 두 테이블에 중복 저장하지 않는다. 프로필은 가입 직후 아직 없을 수 있어 `User` 1 : `Profile` 0..1로 둔다. |
| 기술 정규화 | 표준 `Skill`과 입력 표현 `SkillAlias`를 분리한다. 사용자·프로젝트·공고가 같은 표준 기술을 참조하므로 비교와 집계에 문자열 중복이 생기지 않는다. |
| 채용 출처와 중복 | 아키텍처의 `JobSource`를 출처 기준으로 사용하고 `(job_source_id, external_id)`를 유일하게 둔다. 회사명·제목·설명 기반 보조 식별은 필요한 경우 검토하며 MVP의 추가 유일성 제약으로 확정하지 않는다. |
| AI 분석 | 공고당 현재 분석 결과 하나만 저장한다. 상태와 검증된 결과는 `AIAnalysis`, 정규화된 기술 관계는 `JobSkill`에 둔다. 실패한 원시 LLM 응답은 정상 결과로 저장하지 않는다. 재시도는 같은 분석 행을 갱신한다. |
| 관심 공고와 지원 | `Bookmark`와 `Application`은 독립적이다. `INTERESTED` 지원 상태가 있어도 북마크를 강제 생성하지 않는다. 사용자·공고당 각각 최대 한 건으로 단순화한다. |
| 지원 이력 | 요구사항의 “상태가 변경될 때마다”를 기준으로 최초 상태 등록과 이후 변경을 `ApplicationStatusHistory`에 기록한다. 아키텍처의 “필요한 경우”보다 구체적인 요구사항을 따른다. |
| 파생 데이터 | 적합도·Skill Gap·기본 학습 우선순위·시장 수요·기존 대시보드 `nextActions`는 기존 데이터에서 계산한다. B03의 개인 할 일은 별도 `personal_todo`에 저장한다. |

`ui-spec.md`의 이력서·알림·확장형 캐릭터 화면은 현재 MVP 기능 범위를 넓히는 DB 근거로 사용하지 않는다. 학습 우선순위는 `user-flow.md`와 `development-plan.md`의 **기본 규칙 기반 계산**까지만 MVP에 포함한다.

## 2. 관계 개요

```mermaid
erDiagram
    User ||--o| Profile : owns
    User ||--o{ UserSkill : has
    Skill ||--o{ UserSkill : selected_by
    Skill ||--o{ SkillAlias : has
    User ||--o{ Project : owns
    Project ||--o{ ProjectSkill : uses
    Skill ||--o{ ProjectSkill : used_in
    JobSource ||--o{ JobPosting : supplies
    Company ||--o{ JobPosting : posts
    JobPosting ||--o{ JobSkill : requires
    Skill ||--o{ JobSkill : required_in
    JobPosting ||--o| AIAnalysis : analyzed_as
    User ||--o{ InterestedCompany : tracks
    User ||--o{ Bookmark : saves
    JobPosting ||--o{ Bookmark : saved_as
    User ||--o{ PersonalSavedJob : saves_directly
    User ||--o{ PersonalTodo : manages
    User ||--o{ Resume : owns
    Resume ||--|{ ResumeVersion : has
    User ||--o{ Application : submits
    JobPosting ||--o{ Application : applied_to
    PersonalSavedJob ||--o{ Application : applied_to
    PersonalSavedJob ||--o| PersonalSavedJobAnalysis : analyzed_as
    Application ||--o{ ApplicationStatusHistory : changes
```

관계의 의미: `User`–`Skill`, `Project`–`Skill`, `JobPosting`–`Skill`, `User`–`JobPosting`(북마크 및 지원)은 각각 N:M이며 아래 중간 테이블을 통해 표현한다. 회사·출처 하나에는 공고가 여러 개 올 수 있다. `ApplicationStatusHistory`는 지원 한 건의 1:N 기록이다.

## 3. MVP 엔티티

표의 `id`는 각 테이블의 PK다. `*_id`는 별도 표기가 없으면 이름에 대응하는 테이블의 `id`를 참조하는 FK다. 주요 컬럼만 나열하며 생성·수정 시각 등 공통 운영 컬럼은 필요한 테이블에 포함한다.

### 3.1 계정, 역량, 프로젝트

S03 물리 매핑: `User`는 `users` 테이블로 구현한다. `id`는 BIGINT identity, `email`은 VARCHAR(254), `password_hash`는 VARCHAR(100), `created_at`은 TIMESTAMP WITH TIME ZONE이며 모두 필수다. `V1__create_users.sql`은 정규화된 이메일의 UNIQUE와 `email = lower(btrim(email))` CHECK를 적용한다. 서버 세션은 메모리에 보관하며 인증용 DB 테이블은 추가하지 않는다. 기존 데이터 삭제·변경 migration은 없다.

B01에서는 `users.credential_version` BIGINT NOT NULL DEFAULT 0을 V12 migration으로 추가한다. 비밀번호 변경 트랜잭션에서 사용자 행을 잠그고 BCrypt 해시 갱신과 버전 증가를 함께 커밋한다. 로그인한 세션에는 당시 버전을 기록하며, 보호 API 요청마다 저장된 버전과 비교한다. 기존 세션에 버전 기록이 없으면 0으로 간주하므로 첫 변경 이후에는 거절된다. 세션 자체는 계속 메모리에 두며 별도 세션 테이블이나 비밀번호 이력은 만들지 않는다.

S04 물리 매핑: `V3__create_profiles.sql`은 `profiles`를 새로 만들고 `user_id`의 FK·UNIQUE로 사용자당 0..1건을 보장한다. 이메일은 `users.email`에만 저장한다. 프로필은 `id` BIGINT identity, `name` VARCHAR(100) 필수, 희망 직무·경력·지역 각 VARCHAR(100), 자기소개 VARCHAR(2000), 학력·자격증 각 VARCHAR(1000), `updated_at` TIMESTAMP WITH TIME ZONE 필수다. 기존 테이블이나 데이터를 변경하지 않는다.

| 엔티티 | 목적 | 주요 컬럼 및 키 | 핵심 제약 |
| --- | --- | --- | --- |
| `User` | 계정과 인증 주체 | `id` PK, `email`, `password_hash`, `created_at` | `email` 필수·유일, 비밀번호 원문 저장 금지 |
| `Profile` | 사용자 취업 프로필 | `id` PK, `user_id` FK, `name`, `desired_role`, `career_level`, `desired_location`, `introduction`, `education`, `certifications`, `updated_at` | `user_id` 필수·유일; 초기 설정 전에는 행이 없어도 됨. 학력·자격증은 사용자 흐름의 선택 입력을 별도 엔티티 없이 담음 |
| `Skill` | 표준 기술명 | `id` PK, `name` | 정규화한 기술명 기준 유일 |
| `SkillAlias` | 여러 입력 이름을 표준 기술에 연결 | `id` PK, `skill_id` FK, `alias_name` | `skill_id`, `alias_name` 필수; 정규화한 별칭은 하나의 `Skill`만 가리킴 |
| `UserSkill` | 사용자가 보유한 기술 | `id` PK, `user_id` FK, `skill_id` FK, `created_at`, `proficiency_level`, `experience_months` | `(user_id, skill_id)` 유일; 숙련도 1~5 또는 null, 경험 개월 0~600 또는 null |
| `Project` | 사용자 프로젝트 경험 | `id` PK, `user_id` FK, `name`, `description`, `start_date`, `end_date`, `role`, `key_features`, `outcome`, `project_url`, `created_at`, `updated_at` | `user_id`, `name`, `start_date` 필수; 종료일이 있으면 시작일보다 빠를 수 없음 |
| `ProjectSkill` | 프로젝트에서 사용한 기술 | `id` PK, `project_id` FK, `skill_id` FK | `(project_id, skill_id)` 유일 |

`UserSkill`과 `ProjectSkill`이 필요한 이유는 한 사용자가 여러 기술을, 한 기술을 여러 사용자가 보유할 수 있고 프로젝트에도 같은 N:M 관계가 있기 때문이다. 역량 비교에는 `UserSkill`과 사용자의 `ProjectSkill`을 합친 기술 집합을 사용한다. 프로젝트 기술을 추가해도 `UserSkill` 행을 자동 생성하지는 않는다.

S05 물리 매핑: `skill`, `skill_alias`, `user_skill`의 ID는 BIGINT identity다. 기술 `name`·별칭 `alias_name`과 각 `normalized_name`은 필수 VARCHAR(100), 공백만 있는 값은 CHECK로 거부한다. `normalized_name`은 애플리케이션의 NFKC·공백 축약·ROOT 소문자 키를 저장하고 각 테이블에서 UNIQUE다. 표준명도 `skill_alias`에 등록해 모든 입력 표현을 하나의 별칭 키 공간에 예약한다. 서비스는 충돌 시 다른 Skill을 생성하지 않고 정규화 ID를 재사용한다. `skill_alias.skill_id`, `user_skill.user_id`·`skill_id`는 필수 FK이고 UserSkill은 TIMESTAMPTZ `created_at`과 `(user_id, skill_id)` UNIQUE를 갖는다. 사용자 기술 삭제는 관계만 지우며 FK cascade는 사용하지 않는다.

`V4__create_skills.sql`은 위 세 테이블과 16개 초기 기술·표준명 별칭 16개·추가 별칭 7개를 생성한다. S05 작업 DB에는 같은 SQL이 V3으로 적용되어 있으므로 해당 DB에는 통합본을 직접 적용하지 않는다. 기존 이력은 수정하지 않았으며 상세 검증·통합 주의사항은 [S05 보고](s05-implementation-report.md)를 따른다.

B02 물리 매핑: main 통합 순서에 맞춘 `V13__user_skill_experience.sql`은 기존 `user_skill`에 nullable INTEGER `proficiency_level`·`experience_months`와 각각 1~5·0~600 CHECK만 추가한다. 기존 행은 두 값이 null이며 기존 행·migration은 변경하지 않는다. 사용자 기술 관계 삭제 시 값도 함께 삭제되고 재등록은 새 null 관계다. 프로젝트 기술은 값을 자동 생성하거나 합산하지 않으며 적합도·Skill Gap의 기술 집합 계산은 그대로다.

S06 물리 매핑: `V5__create_projects.sql`은 `project`·`project_skill`만 추가한다. ID는 BIGINT identity, 프로젝트의 `user_id`는 users FK, 이름은 필수 VARCHAR(100)·공백 검사, 역할은 VARCHAR(100), 설명·주요 기능·성과·URL은 VARCHAR(2000)이다. 시작일은 필수 DATE, 종료일은 선택 DATE·날짜 순서 CHECK, 생성·수정 시각은 필수 TIMESTAMPTZ다. 목록을 위해 `(user_id, created_at DESC, id DESC)` 인덱스를 둔다. ProjectSkill은 두 필수 FK와 `(project_id, skill_id)` UNIQUE, `skill_id` 인덱스를 갖는다. FK cascade 없이 서비스 트랜잭션과 JPA orphan removal로 해당 프로젝트 관계를 삭제한다. 수정·삭제는 프로젝트 행 잠금으로 직렬화한다. 기존 테이블·데이터·migration 이력은 변경하지 않는다.

### 3.2 채용공고와 AI 분석

| 엔티티 | 목적 | 주요 컬럼 및 키 | 핵심 제약 |
| --- | --- | --- | --- |
| `Company` | 공고를 게시한 기업 | `id` PK, `name` | `name` 필수; 동명 기업 가능성을 고려해 이름만으로 유일성을 강제하지 않음 |
| `JobSource` | 공식 채용 데이터 출처 | `id` PK, `code`, `name` | `code` 필수·유일; 출처는 Work24와 ALIO_RECRUITMENT를 구분 |
| `JobPosting` | 외부 공고의 정규화된 원문·기본 정보 | `id` PK, `job_source_id` FK, `external_id`, `company_id` FK, `title`, `description`, `employment_type`, `career_requirement`, `location`, `posted_date`, `deadline_date`, `source_url`, `created_at`, `updated_at` | 출처·외부 ID·회사·제목·원문 URL 필수; `(job_source_id, external_id)` 유일. 마감일이 있으면 게시일보다 빠를 수 없음 |
| `job_collection_run` | ALIO 관리자 수동 배치의 마지막 실행 상태 | `source_code` PK, `run_id` UUID, `status`, 시작·갱신·종료 시각, 처리 페이지·생성·중복·거절·실패 건수, `source_error` | 출처별 한 행; 모든 건수는 0 이상. 10분 이상 갱신되지 않은 RUNNING은 다음 명시적 실행으로 교체 가능 |
| `JobRecruitmentStep` | 청년일자리 공고의 전형 단계 | `job_posting_id`·`external_id` 복합 PK, `sort_order`, `title`, `openings`, `applicants`, `competition_rate`, `event_date` | 공고 FK는 삭제 시 단계 메타정보만 함께 삭제 |
| `JobRecruitmentAttachment` | 청년일자리 공고의 첨부파일 메타정보 | `job_posting_id`·`external_id` 복합 PK, `sort_order`, `name`, `file_type`, `url` | 파일 본문은 저장하지 않음; 공고 FK는 삭제 시 메타정보만 함께 삭제 |
| `AIAnalysis` | 공고별 현재 분석 상태와 검증된 구조화 결과 | `id` PK, `job_posting_id` FK, `status`, `result_json`, `failure_reason`, `analyzed_at`, `updated_at` | `job_posting_id` 필수·유일; `status ∈ {PENDING, COMPLETED, FAILED}`. `COMPLETED` 결과만 검증·정규화해 저장; 실패 시 공고 본문은 유지 |
| `JobSkill` | 공고의 정규화된 요구 기술 | `id` PK, `job_posting_id` FK, `skill_id` FK, `requirement_type` | `(job_posting_id, skill_id)` 유일; `requirement_type ∈ {REQUIRED, PREFERRED}` |

`JobSkill`은 공고와 기술 간 N:M 관계에 필수·우대 구분을 추가한다. 한 공고에서 같은 기술이 필수와 우대로 모두 추출되면 `REQUIRED` 한 행으로 정규화한다. `JobSkill`은 유효한 분석이 완료된 뒤 저장하며, 분석 전이거나 실패한 공고는 기술 행이 없어도 기본 정보 조회가 가능하다. `AIAnalysis.result_json`은 검증을 통과한 구조화 결과만 보관하고, 비교·집계는 `JobSkill`을 기준으로 한다. 무효한 응답을 재사용 가능한 결과로 취급하지 않는다.

S12 물리 매핑: `V8__create_job_analysis.sql`은 기존 V1~V7 뒤에 `ai_analysis`와 `job_skill`만 추가한다. `ai_analysis.job_posting_id`는 필수·유일 FK, `status`는 세 상태만 허용하고 `result_json`은 JSONB, `updated_at`은 필수 TIMESTAMPTZ다. `job_skill`은 공고·기술 FK와 `(job_posting_id, skill_id)` UNIQUE, 기술 ID 인덱스를 갖는다. AI가 검증된 미등록 기술명을 반환하면 공통 `skill`·`skill_alias`에도 행이 추가될 수 있으며 기존 migration·데이터는 수정하지 않는다. 분석 요청과 완료 쓰기는 공고 행 잠금으로 직렬화하고 완료 결과는 재사용한다.

### 3.3 관심 공고와 지원 관리

S10 물리 매핑: `V6__create_bookmarks.sql`은 `bookmark` 테이블만 추가한다. `id`는 BIGINT identity, `user_id`·`job_posting_id`는 필수 FK, `created_at`은 필수 TIMESTAMPTZ이며 DB 현재 시각을 기본값으로 사용한다. `(user_id, job_posting_id)` UNIQUE로 동시 중복을 방지하고 `(user_id, created_at DESC, id DESC)` 인덱스로 사용자별 저장순 목록을 지원한다. FK cascade는 없으며 해제는 해당 사용자·공고 관계만 삭제한다. 기존 테이블·데이터·migration은 변경하지 않는다.

S11 물리 매핑: `V7__create_applications.sql`은 기존 데이터를 변경하지 않고 `application`, `application_status_history` 두 테이블을 추가한다. ID는 BIGINT identity, FK는 필수이며 cascade 삭제는 없다. `application`은 `(user_id, job_posting_id)` UNIQUE, 상태 VARCHAR(30) CHECK, 지원일 DATE, 다음 일정·생성·수정 시각 TIMESTAMPTZ, 메모 VARCHAR(2000)이다. 실제 지원 이후 상태의 지원일은 DB CHECK로도 필수다. 이력은 from/to 상태 VARCHAR(30) CHECK, 변경 시각 TIMESTAMPTZ 필수이며 최초 from만 null이다. 사용자·상태·등록 시각·ID 목록 인덱스와 지원·변경 시각·ID 이력 인덱스를 둔다. 서비스가 초기·전이 이력을 같은 트랜잭션에 저장하고 수정 시 행 잠금으로 동시 상태 변경을 보호한다.

| 엔티티 | 목적 | 주요 컬럼 및 키 | 핵심 제약 |
| --- | --- | --- | --- |
| `Bookmark` | 사용자별 관심 공고 | `id` PK, `user_id` FK, `job_posting_id` FK, `created_at` | `(user_id, job_posting_id)` 유일 |
| `PersonalSavedJob` | 사용자 직접 등록 개인 관심공고 | `id` PK, `user_id` FK, `url`, `company_name`, `title`, `role`, `career_level`, `location`, `employment_type`, `deadline_date`, `note`, `description`, `created_at`, `updated_at`, `deleted_at` | 활성 `(user_id, url)` 부분 UNIQUE. 삭제는 `deleted_at`을 채워 이력 보존 |
| `PersonalSavedJobAnalysis` | 사용자가 붙여넣은 개인 공고 본문의 AI 분석 | `personal_saved_job_id` PK·FK, `status`, `result_json`, `failure_reason`, `analyzed_at`, `updated_at` | 개인 공고당 최대 한 행. 제목·본문 수정 시 기존 결과 삭제 |
| `Application` | 공고별 현재 지원 상황 | `id` PK, `user_id` FK, nullable `job_posting_id` FK, nullable `personal_saved_job_id` FK, `current_status`, `applied_date`, `next_schedule_at`, `note`, `created_at`, `updated_at` | 두 공고 FK 중 정확히 하나만 값; 사용자·공고 종류별 유일; 상태는 아래 허용값 중 하나 |
| `ApplicationStatusHistory` | 지원 상태 변경 기록 | `id` PK, `application_id` FK, `from_status`, `to_status`, `changed_at` | `to_status`, `changed_at` 필수; 최초 등록 시 `from_status`는 비움; 상태가 실제 변경될 때마다 한 행 추가 |

`Bookmark`와 `Application`은 각각 사용자와 공고 사이의 관계에 별도 의미와 속성이 있어 중간 테이블로 둔다. `Application.current_status`의 허용값은 `INTERESTED`, `PLANNED`, `APPLIED`, `DOCUMENT_PASSED`, `INTERVIEW`, `FINAL_PASSED`, `REJECTED`, `WITHDRAWN`이다. 지원일은 실제 지원을 기록할 때 사용하며, 메모와 다음 일정은 사용자 흐름에 있는 선택 정보다. 상태의 전이 가능 여부는 `user-flow.md`를 따르며 DB의 허용값 제약만으로 전이 규칙을 대신하지 않는다.

`V10__personal_saved_jobs.sql`은 공용 `JobPosting`/`Bookmark`를 변경하지 않고 `personal_saved_job`을 추가한다. 기존 `application.job_posting_id`는 nullable로 바뀌지만 기존 행은 그대로 유지한다. `ck_application_one_job`과 개인 공고별 부분 UNIQUE가 두 참조를 보호한다. `V11__personal_saved_job_analysis.sql`은 개인 공고 본문과 별도 분석 테이블을 추가한다. 개인 공고는 `JobSource`나 공용 `ai_analysis`·`job_skill`에 연결하지 않는다.

## 4. 공통 제약과 조회 기준

- 모든 FK는 존재하는 부모를 참조해야 한다. 사용자 소유 데이터는 인증된 사용자 ID를 기준으로 조회·수정 권한을 검사한다. 공고·기술·회사·출처는 사용자별로 복제하지 않는 공통 데이터다.
- 이메일·기술명·별칭은 입력 표기의 대소문자 차이 때문에 중복되지 않도록 정규화 비교를 적용한다. 구체적인 인덱스·마이그레이션 표현은 구현 단계에서 PostgreSQL에 맞춰 정한다.
- 사용자 또는 공고의 삭제 정책은 현재 문서에서 확정되지 않았다. MVP 설계는 연관 기록을 암묵적으로 대량 삭제하지 않으며, 삭제 기능을 구현할 때 관련 이력의 보존 정책을 먼저 결정한다.
- 검색 필터는 `JobPosting` 기본 필드와 `Company`, `JobSkill` 조인으로 구성한다. MVP의 직무 필터는 별도 직무 테이블 없이 공고 제목으로 좁힌다. 시장 기술 수요는 완료된 공고의 `JobSkill` 집계, 역량 비교는 `UserSkill`·`ProjectSkill`과 `JobSkill`의 비교로 계산한다.
- B08 경력·지역 분포는 공용 `JobPosting`의 기본 필드를, 기술 추이는 `AIAnalysis`가 `COMPLETED`인 공고의 `JobSkill` 관계를 읽기 전용으로 집계한다. `(job_source_id, external_id)`가 저장 공고 식별 단위이고 출처 간 동일 내용은 별개다. 집계 결과 테이블이나 migration은 추가하지 않는다. 새 공식 출처도 같은 공용 관계에 저장되면 집계에 포함한다.

## 5. MVP 이후 확장 영역

### B03 개인 할 일

`V14__personal_todos.sql`은 `personal_todo`를 추가한다. `id` BIGINT identity PK, `user_id` 필수 users FK, `title` 필수 VARCHAR(200)·공백 검사, `description` VARCHAR(2000), `due_at` TIMESTAMPTZ와 `due_time_zone` VARCHAR(100)은 둘 다 있거나 둘 다 없다. `completed_at`·`deleted_at`은 nullable TIMESTAMPTZ, `created_at`·`updated_at`은 필수 TIMESTAMPTZ다. 활성 목록 조회용 `(user_id, due_at ASC NULLS LAST, id DESC)` 부분 인덱스를 둔다. 서버는 `due_time_zone`의 IANA ID와 `due_at`의 요청 오프셋 일치를 검증한다. 완료 취소 시 `completed_at`을 비우고, 삭제 시 `deleted_at`을 채워 일반 조회에서 제외한다. 지원 기록·`nextActions`와 관계를 만들지 않는다. B10 보상과의 관계는 미정이다.

### B04 관심 기업의 별도 소유 모델

InterestedCompany는 사용자별 관심 기업 정보로 User 1:N이며 공고 수집용 공용 Company와 FK가 없다. id는 각각 독립된 ID 공간이다. B11 출처 확장도 공용 회사명을 사용자 기록과 자동 병합하지 않는다. 현재 JobPostingWriter는 신규 공고에 새 공용 Company를 연결하고, 같은 회사명만으로 공용 행끼리도 병합하지 않는다.

V15__create_interested_companies.sql은 interested_company만 추가한다. id BIGINT identity, user_id 필수 users FK, name 필수 VARCHAR(200), website_url 선택 VARCHAR(2048), note 선택 VARCHAR(2000), status 필수 VARCHAR(20) CHECK(INTERESTED, RESEARCHING, ARCHIVED), 생성·수정 시각 필수 TIMESTAMPTZ다. (user_id, website_url) UNIQUE는 웹사이트가 있는 기록의 사용자별 중복을 막는다. URL이 null인 동명 기록은 허용한다. 사용자별 목록에 (user_id, created_at DESC, id DESC) 인덱스를 사용한다. 삭제는 사용자 기록 한 건만 제거하고 공용 회사·공고 관계에는 영향이 없다. 기존 테이블·데이터를 변경하지 않는다.

### B05 이력서·불변 버전

`V16__resumes.sql`은 `resume`과 `resume_version`을 추가한다. `resume`은 BIGINT identity `id`, 필수 `user_id` FK, 공백 제외 필수 `title` VARCHAR(200), 필수 `created_at`·`updated_at` TIMESTAMPTZ, 선택 `deleted_at` TIMESTAMPTZ를 가진다. 활성 목록에는 `(user_id, updated_at DESC, id DESC)` 부분 인덱스, 만료 정리에는 `deleted_at` 부분 인덱스를 둔다. 이력서 삭제는 `deleted_at`만 채우고 조회·B12 분석 원본 선택에서 즉시 제외한다.

`resume_version`은 BIGINT identity `id`, 필수 `resume_id` FK, 양의 `version_number`, 필수 `content_ciphertext` BYTEA와 길이 12바이트의 `content_nonce` BYTEA, 필수 `created_at` TIMESTAMPTZ를 가진다. `(resume_id, version_number)` UNIQUE와 버전 순서 인덱스를 둔다. 애플리케이션은 AES-256-GCM, 버전별 난수 nonce, `resumeId`·`versionNumber` AAD로 원문을 암호화하며 DB에 평문을 저장하지 않는다. 번호·ID·생성 시각·암호문은 불변이다. 새 버전 생성은 이력서 행 잠금으로 순차화한다. B12는 `resume_version.id`와 부모 이력서 ID, 버전 생성 시각을 원본 식별에 사용하고 삭제된 부모를 분석하지 않는다. 삭제 30일 이후 매일 03:00 UTC 정리에서 자식 버전과 부모를 물리 삭제한다. DB 백업의 보존 정책은 미정이다.

### B06 면접 일정

`V17__interview_schedules.sql`은 `interview_schedule`을 추가한다. `id` BIGINT identity PK, `user_id` 필수 users FK, `application_id` 선택 application FK, `title` 필수 VARCHAR(200)·공백 검사, `starts_at` 필수 TIMESTAMPTZ, `time_zone` 필수 VARCHAR(100), `cancelled_at` nullable TIMESTAMPTZ, `created_at`·`updated_at` 필수 TIMESTAMPTZ다. 사용자·시각·ID 조회 인덱스와 지원 FK 인덱스를 둔다. 서버는 연결된 지원 건의 소유권과 IANA 시간대·요청 오프셋의 일치를 검증한다. 동일 시작 시각의 일정도 허용한다. 취소는 `cancelled_at`을 기록하고 재활성화는 이를 비운다. `Application.current_status`·상태 이력·`next_schedule_at`은 면접 일정에 의해 자동 변경되지 않는다.

공식 채용 출처 추가, 의미 기반 매칭·추천, 이력서 분석, 복잡한 게이미피케이션, 알림은 아직 현재 테이블에 포함하지 않는다. 향후 요구사항과 아키텍처가 확정되면 별도 설계한다. 현재의 `JobSource`, 공통 `Skill`, 사용자·공고·프로젝트 관계는 확장 시 재사용할 수 있다.
