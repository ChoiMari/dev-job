# Migration boundary

S01에는 도메인 테이블이나 seed SQL이 없다. Flyway는 빈 DB의 이력 테이블만 관리한다.
첫 Entity 단계부터 `V1__description.sql` 형식의 SQL을 추가한다.
JPA는 `validate`로 매핑을 검증하며 테이블을 생성하거나 갱신하지 않는다.
이미 적용된 migration은 수정하지 않고 후속 버전을 추가한다.

통합 순서는 S03 `V1__create_users.sql`, S07 `V2__create_job_collection.sql`,
S04 `V3__create_profiles.sql`, S05 `V4__create_skills.sql`,
S06 `V5__create_projects.sql`, S10 `V6__create_bookmarks.sql`,
S11 `V7__create_applications.sql`, S12 `V8__create_job_analysis.sql`,
S09 `V9__create_job_recruitment_details.sql`, 개인 공고 `V10__personal_saved_jobs.sql`·`V11__personal_saved_job_analysis.sql`,
B01 인증 버전 `V12__add_user_credential_version.sql`, B02 기술 숙련도·경험 `V13__user_skill_experience.sql`,
B03 개인 할 일 `V14__personal_todos.sql`, B04 관심 기업 `V15__create_interested_companies.sql`,
B05 이력서 버전 `V16__resumes.sql`이다.
S05 격리 DB `devjob_s05_test`에는 기술 migration이 이미 V3으로 적용되어 있으므로
통합본을 해당 DB에 직접 실행하지 않는다. 각 DB의 `flyway_schema_history`를 확인하고
이미 적용한 파일의 이름·checksum을 임의로 바꾸거나 `repair`·`clean`으로 해결하지 않는다.
기존 이력과 격리 검증은 `docs/s05-implementation-report.md`에 기록한다.
