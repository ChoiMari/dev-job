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
B05 이력서 버전 `V16__resumes.sql`, B06 면접 일정 `V17__interview_schedules.sql`,
B11 ALIO 수동 배치 `V18__alio_collection_run.sql`, B09 캐릭터 장착 `V19__character_equipment.sql`·
헤어/안경 확장 `V20__character_layer_slots.sql`·토끼탈 의상 허용 `V21__character_bunny_costume.sql`,
B07 학습 목표 `V22__learning_goals.sql`, B10 캐릭터 성장 `V23__character_progress.sql`, B12 자기소개서·문서 분석 `V24__document_analysis.sql`, B13 앱 내 알림 `V25__notifications.sql`, B14 의미 기반 비교·추천 `V26__semantic_recommendations.sql`, B06 면접 상세 정보 `V27__interview_details.sql`, 면접 완료 상태 `V28__interview_completion.sql`이다. 독립 작업 트리의 migration 번호는 main 통합 순서에 맞춰 배치했다.
S05 격리 DB `devjob_s05_test`에는 기술 migration이 이미 V3으로 적용되어 있으므로
통합본을 해당 DB에 직접 실행하지 않는다. 각 DB의 `flyway_schema_history`를 확인하고
이미 적용한 파일의 이름·checksum을 임의로 바꾸거나 `repair`·`clean`으로 해결하지 않는다.
기존 이력과 격리 검증은 `docs/s05-implementation-report.md`에 기록한다.

V35__interested_company_profile.sql은 기존 관심 기업 행에 산업·규모·지역·관심도·즐겨찾기를 추가하고, 기업별 태그 연결 및 사용자 태그 표를 만든다. 기존 행은 관심도 MEDIUM, 즐겨찾기 false, 태그 없음으로 유지한다.
V36__company_tag_presentation.sql은 사용자 기업 태그에 색상 키와 정렬 순서를 추가한다. 기존 태그는 파랑으로 유지하고 기존 계정의 기본 8개 태그를 채운다. 신규 계정은 첫 목록 조회 때 기본 태그를 준비한다.

V44__resume_draft.sql은 계정별 이력서 작성 초안 1건을 암호문과 nonce로 저장한다. 기존 이력서·버전 데이터는 변경하지 않는다.
V45__resume_draft_multiple.sql은 기존 초안 행을 보존하면서 초안 ID를 부여하고 계정별 여러 초안을 저장하도록 PK를 바꾼다. 애플리케이션에서 계정당 최대 20건을 제한한다.
V46__resume_version_labels.sql은 기존 버전을 보존하면서 선택 버전 제목·설명 컬럼을 추가한다.
V47__resume_version_form.sql은 기존 버전을 보존하면서 양식 이력서 버전의 암호화 JSON과 nonce 컬럼을 추가한다.
