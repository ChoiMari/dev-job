# DevJob REST API 명세 (MVP 설계 예정)

## 1. 상태와 공통 계약

이 문서의 **모든 API는 설계 예정이며 구현 완료를 뜻하지 않는다.** 기준 문서는 `requirements.md`, `user-flow.md`, `architecture.md`, `erd.md`다. 기본 경로는 `/api`, 요청·응답 본문은 JSON이다. 외부 채용 API 수집은 Backend의 Adapter 처리 범위이며, 근거 없는 공개 수집·관리자 API를 추가하지 않는다.

- `{...Id}`는 양의 정수 식별자다. 날짜는 `YYYY-MM-DD`, 일시는 시간대가 포함된 ISO 8601 문자열로 표현한다. 값이 없는 선택 필드는 `null`로 응답한다.
- `page`·`size`를 받는 목록은 `page`(0부터 시작, 기본 0), `size`(1~100, 기본 20)를 사용하고 `{ "items": [], "page": 0, "size": 20, "totalElements": 0 }` 형태로 응답한다. 공고 `sort`는 `latest`(기본), `deadline`, `matchRate`를 허용한다. 내 기술 목록과 한 지원 건의 상태 이력은 페이지 없이 반환한다.
- 성공 응답은 아래에 적은 리소스 JSON을 직접 반환한다. 본문 없는 삭제·로그아웃은 `204 No Content`다. 공통 오류 본문은 `{ "code": "ERROR_CODE", "message": "사용자에게 표시할 설명" }`이다. 내부 예외·Secret·외부 API 원문은 노출하지 않는다.
- 인증 필요 여부의 `예`는 로그인한 사용자만 호출할 수 있다는 뜻이다. 현재 문서는 토큰·세션 전달 방식을 정하지 않았으므로 이 명세도 특정 방식을 구현된 계약처럼 표현하지 않는다. 프로필, 사용자 기술, 프로젝트, 북마크, 지원, 개인 분석은 서버에서 리소스 소유권을 확인한다.
- 공통 오류: 입력 오류 `400`, 인증 없음 `401`, 소유권 없음 `403`, 대상 없음 `404`, 중복·상태 충돌 `409`, 서버 오류 `500`. 외부 연동 실패는 해당 기능에서 `502` 또는 `503`으로 표시할 수 있으며 저장된 공고·CRM 조회는 계속 가능해야 한다.

### 공통 값

- 지원 상태: `INTERESTED`, `PLANNED`, `APPLIED`, `DOCUMENT_PASSED`, `INTERVIEW`, `FINAL_PASSED`, `REJECTED`, `WITHDRAWN`.
- 공고 기술 유형: `REQUIRED`, `PREFERRED`.
- AI 분석 상태: `PENDING`, `COMPLETED`, `FAILED`. 분석 행이 아직 없는 공고는 상세에서 `analysis: null`로 표현한다.
- `Skill` 응답: `{ "id": 1, "name": "PostgreSQL" }`. `JobSkill` 응답: `{ "skill": { "id": 1, "name": "PostgreSQL" }, "requirementType": "REQUIRED" }`.
- 아래 예시의 `Skill`, `JobSummary`, `Skill[]` 같은 표기는 위에서 정의한 응답 타입 참조이며 JSON 문자열 값이 아니다.
- 모든 생성·수정 요청은 필수값, 길이·형식, 참조 ID의 존재, 상태값을 검증한다. 알 수 없는 기술명을 임의 문자열로 `UserSkill`·`ProjectSkill`·`JobSkill`에 저장하지 않는다.

## 2. 인증과 프로필

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 회원가입 `POST /api/auth/register` | 아니요 | 없음 | `{ "email": "user@example.com", "password": "..." }` | `{ "id": 1, "email": "user@example.com" }` · `201` | 형식 오류 `400`, 이메일 중복 `409` |
| 로그인 `POST /api/auth/login` | 아니요 | 없음 | `{ "email": "...", "password": "..." }` | `{ "user": { "id": 1, "email": "..." } }` · `200` | 자격 증명 오류 `401` |
| 로그아웃 `POST /api/auth/logout` | 예 | 없음 | 없음 | 본문 없음 · `204` | 인증 없음 `401` |
| 현재 사용자 확인 `GET /api/auth/me` | 예 | 없음 | 없음 | `{ "id": 1, "email": "..." }` · `200` | 인증 없음 `401` |
| 내 프로필 조회 `GET /api/me/profile` | 예 | 없음 | 없음 | 아래 `Profile` · `200`; 프로필 미설정 시 `404` | 인증 없음 `401` |
| 내 프로필 생성·수정 `PUT /api/me/profile` | 예 | 없음 | `Profile` 입력 필드 | 아래 `Profile` · 최초 `201`, 수정 `200` | 값 오류 `400`, 인증 없음 `401`, 이메일 중복 `409` |

`Profile` 입력 필드: `email`, `name`, `desiredRole`, `careerLevel`, `desiredLocation`, `introduction`, `education`, `certifications`. `email`과 `name`은 필수, 나머지는 선택이다. 응답은 `{ "id": 1, "email": "user@example.com", "name": "홍길동", "desiredRole": "백엔드 개발자", "careerLevel": "신입", "desiredLocation": "서울", "introduction": null, "education": null, "certifications": null }` 형태다. 이메일은 `User.email`을 조회·갱신하고 `Profile`에 중복 저장하지 않는다. `PUT`은 같은 사용자 프로필 한 건을 생성 또는 교체하며, 선택 필드는 누락 시 `null`로 본다.

## 3. 기술과 프로젝트

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 표준 기술 검색 `GET /api/skills` | 예 | Query: `q`, `page`, `size` | 없음 | `Skill` 목록 · `200` | 잘못된 검색값 `400` |
| 내 기술 목록 `GET /api/me/skills` | 예 | 없음 | 없음 | `{ "items": [{ "id": 1, "name": "Java" }] }` · `200` | 인증 없음 `401` |
| 내 기술 추가 `POST /api/me/skills` | 예 | 없음 | `{ "skillId": 1 }` 또는 `{ "name": "Postgres" }` | `Skill` · `201` | 값 오류 `400`, 기술 ID 없음 `404`, 이미 보유 `409` |
| 내 기술 삭제 `DELETE /api/me/skills/{skillId}` | 예 | Path: `skillId` | 없음 | 본문 없음 · `204` | 등록된 기술 없음 `404` |
| 내 프로젝트 목록 `GET /api/me/projects` | 예 | Query: `page`, `size` | 없음 | `Project` 목록 · `200` | 잘못된 페이지 `400` |
| 내 프로젝트 등록 `POST /api/me/projects` | 예 | 없음 | 아래 `Project` 입력 | `Project` · `201` | 값 오류 `400`, 기술 없음 `404` |
| 내 프로젝트 상세 `GET /api/me/projects/{projectId}` | 예 | Path: `projectId` | 없음 | `Project` · `200` | 없음 `404`, 타인 소유 `403` |
| 내 프로젝트 수정 `PUT /api/me/projects/{projectId}` | 예 | Path: `projectId` | 아래 `Project` 입력 | `Project` · `200` | 값 오류 `400`, 없음 `404`, 타인 소유 `403` |
| 내 프로젝트 삭제 `DELETE /api/me/projects/{projectId}` | 예 | Path: `projectId` | 없음 | 본문 없음 · `204` | 없음 `404`, 타인 소유 `403` |

`Project` 입력: `{ "name": "프로젝트명", "description": "...", "startDate": "2026-01-01", "endDate": null, "role": "백엔드", "keyFeatures": "...", "outcome": "...", "projectUrl": null, "skillIds": [1, 2] }`. `name`, `startDate`, `skillIds`는 필수이고 `skillIds`는 빈 배열이 가능하다. 그 외 텍스트·URL·종료일은 선택이다. 응답에는 `id`, 위 정보, `skills: Skill[]`를 포함한다. 수정 시 `skillIds`는 전달한 목록으로 프로젝트 기술 관계를 교체한다. 프로젝트 기술을 수정해도 보유 기술 목록이 자동으로 변하지 않는다.

기술 추가 요청은 `skillId`와 `name` 중 하나만 보낸다. `name`은 기존 표준 기술명·별칭으로 먼저 정규화하고, 일치 항목이 없으면 해당 이름의 표준 `Skill`을 생성해 연결한다. 문자열 자체를 `UserSkill`에 저장하지 않는다. 별칭 목록 관리는 공개 사용자 API 범위에 넣지 않는다.

## 4. 채용공고, AI 분석, 역량 비교

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 공고 검색·필터 `GET /api/jobs` | 예 | Query: `q`, `company`, `skillId`, `careerLevel`, `location`, `employmentType`, `deadlineBefore`, `minMatchRate`, `applicationStatus`, `page`, `size`, `sort` | 없음 | `JobSummary` 목록 · `200` | 필터·정렬값 오류 `400` |
| 공고 상세 `GET /api/jobs/{jobId}` | 예 | Path: `jobId` | 없음 | 아래 `JobDetail` · `200` | 공고 없음 `404` |
| AI 분석 요청·재시도 `POST /api/jobs/{jobId}/analysis` | 예 | Path: `jobId` | 없음 | `AIAnalysis` · 새 요청/진행 중 `202`, 완료 결과 재사용 `200` | 공고 없음 `404`, 분석 요청 접수 실패 `503` |
| AI 분석 상태·결과 `GET /api/jobs/{jobId}/analysis` | 예 | Path: `jobId` | 없음 | 아래 `AIAnalysis` · `200` | 공고 또는 분석 행 없음 `404` |
| 내 역량과 공고 비교 `GET /api/jobs/{jobId}/match` | 예 | Path: `jobId` | 없음 | 아래 `JobMatch` · `200` | 공고 없음 `404`, 분석 미완료 `409` |

`JobSummary`: `{ "id": 10, "title": "백엔드 개발자", "company": { "id": 3, "name": "A기업" }, "source": "WORK24", "location": "서울", "careerRequirement": "신입", "employmentType": "정규직", "deadlineDate": "2026-12-31", "matchRate": null, "bookmarked": false, "applicationStatus": null }`. `matchRate`는 사용자 기술과 완료된 분석 결과가 있어 계산 가능할 때만 값이 있으며, 합격 확률이 아니다.

공고 목록의 `minMatchRate`는 0~100이며 계산 가능한 공고에만 적용하고 분석 전 공고는 해당 필터에서 제외한다. `applicationStatus`는 현재 사용자의 지원 상태로 필터링한다. `sort=matchRate`에서도 계산할 수 없는 공고는 뒤에 둔다.

`JobDetail`은 `JobSummary`의 필드에 `description`, `postedDate`, `sourceUrl`, `requiredSkills: JobSkill[]`, `preferredSkills: JobSkill[]`, `analysis: { "status": "PENDING|COMPLETED|FAILED" } | null`을 추가한다. 분석 전·실패 상태여도 원문과 기본 정보는 반환한다. `source`는 `JobSource.code`다.

`AIAnalysis`: `{ "status": "COMPLETED", "requiredSkills": [Skill], "preferredSkills": [Skill], "analyzedAt": "2026-10-05T10:00:00+09:00" }`. `PENDING`에는 기술 목록을 빈 배열로, `FAILED`에는 기술 목록을 빈 배열과 일반적인 `failureReason`을 반환한다. 검증되지 않은 LLM 원문이나 Secret은 반환하지 않는다. 이미 완료된 결과는 다시 호출하지 않고 재사용한다. 실패 상태에서 다시 POST하면 같은 분석 대상을 재시도한다.

`JobMatch`: `{ "available": true, "required": { "matched": [Skill], "missing": [Skill], "total": 4 }, "preferred": { "matched": [Skill], "missing": [Skill], "total": 2 }, "matchRate": 83 }`. `UserSkill`과 사용자의 `ProjectSkill`을 합친 기술 집합으로 비교한다. `matchRate`는 `(일치한 필수 + 일치한 우대) / (전체 필수 + 전체 우대) × 100`을 반올림한 0~100 값이다. 공고에 분석된 기술이 전혀 없거나 사용자·프로젝트 양쪽에 기술이 없으면 `available: false`, 각 목록은 빈 배열, `matchRate: null`, `reason: "NO_JOB_SKILLS"` 또는 `"USER_SKILLS_EMPTY"`로 응답한다.

## 5. 북마크와 지원 관리

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 관심 공고 목록 `GET /api/bookmarks` | 예 | Query: `page`, `size` | 없음 | `Bookmark` 목록 · `200` | 인증 없음 `401` |
| 관심 공고 저장 `POST /api/bookmarks` | 예 | 없음 | `{ "jobId": 10 }` | `Bookmark` · `201` | 공고 없음 `404`, 이미 저장 `409` |
| 관심 공고 삭제 `DELETE /api/bookmarks/{jobId}` | 예 | Path: `jobId` | 없음 | 본문 없음 · `204` | 저장 기록 없음 `404` |
| 내 지원 목록 `GET /api/applications` | 예 | Query: `status`, `page`, `size` | 없음 | `Application` 목록 · `200` | 상태값 오류 `400` |
| 지원 등록 `POST /api/applications` | 예 | 없음 | `{ "jobId": 10, "status": "PLANNED", "appliedDate": null, "note": null, "nextScheduleAt": null }` | `Application` · `201` | 공고 없음 `404`, 중복 `409`, 상태값 오류 `400` |
| 지원 상세 `GET /api/applications/{applicationId}` | 예 | Path: `applicationId` | 없음 | `Application` · `200` | 없음 `404`, 타인 소유 `403` |
| 지원 메모·일정 수정 `PATCH /api/applications/{applicationId}` | 예 | Path: `applicationId` | `{ "note": "...", "nextScheduleAt": "2026-10-10T14:00:00+09:00" }` 중 변경할 필드 | `Application` · `200` | 값 오류 `400`, 없음 `404`, 타인 소유 `403` |
| 지원 상태 변경 `PATCH /api/applications/{applicationId}/status` | 예 | Path: `applicationId` | `{ "status": "APPLIED", "appliedDate": "2026-10-05" }` | `Application` · `200` | 허용되지 않은 전이·동일 상태 `409`, 값 오류 `400`, 없음 `404`, 타인 소유 `403` |
| 지원 상태 이력 `GET /api/applications/{applicationId}/history` | 예 | Path: `applicationId` | 없음 | `ApplicationStatusHistory[]` · `200` | 없음 `404`, 타인 소유 `403` |

`Bookmark`: `{ "id": 1, "job": JobSummary, "createdAt": "..." }`. `Application`: `{ "id": 1, "job": JobSummary, "currentStatus": "PLANNED", "appliedDate": null, "nextScheduleAt": null, "note": null, "createdAt": "...", "updatedAt": "..." }`. `ApplicationStatusHistory`: `{ "id": 1, "fromStatus": null, "toStatus": "PLANNED", "changedAt": "..." }`. 지원 생성 시 초기 상태는 `INTERESTED`, `PLANNED`, `APPLIED` 중 하나이며 최초 상태도 이력에 남긴다. `APPLIED`로 생성하거나 변경할 때 `appliedDate`를 입력해 실제 지원일을 기록한다. 상태 전이는 `INTERESTED → PLANNED → APPLIED → DOCUMENT_PASSED → INTERVIEW → FINAL_PASSED`를 기본으로 하고, `INTERESTED`·`PLANNED`·`APPLIED`에서 `WITHDRAWN`, `APPLIED`·`DOCUMENT_PASSED`·`INTERVIEW`에서 `REJECTED`를 허용한다. 종료 상태에서는 추가 전이를 허용하지 않는다. 북마크와 지원은 서로 독립적으로 생성·삭제된다.

## 6. 대시보드와 분석

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 내 대시보드 `GET /api/dashboard` | 예 | 없음 | 없음 | 아래 `Dashboard` · `200` | 인증 없음 `401`, 서버 집계 오류 `500` |
| 시장 기술 수요 `GET /api/analytics/skills` | 예 | Query: `dateFrom`, `dateTo`, `desiredRole`, `page`, `size` | 없음 | 아래 `SkillDemand` 목록 · `200` | 기간 오류 `400` |
| 내 기본 Skill Gap·학습 우선순위 `GET /api/me/skill-gap` | 예 | Query: `desiredRole`(선택) | 없음 | 아래 `SkillGap` · `200` | 인증 없음 `401`, 필터 오류 `400` |

`Dashboard`: `{ "applicationCounts": { "PLANNED": 1, "APPLIED": 2, "INTERVIEW": 0 }, "bookmarkCount": 3, "nextActions": [{ "applicationId": 1, "jobId": 10, "status": "PLANNED", "nextScheduleAt": null }], "recommendedJobs": [JobSummary], "skillGapPreview": [Skill] }`. `nextActions`는 지원 상태·일정에서 도출하는 표시용 항목이며 별도 자유 입력·완료 체크 기능을 뜻하지 않는다. 추천 공고는 기본 규칙 기반 적합도만 사용하며 합격 확률을 의미하지 않는다. 데이터가 없거나 분석이 미완료면 해당 배열은 비어 있다.

`SkillDemand`: `{ "skill": Skill, "jobCount": 136, "analyzedJobCount": 200, "ratio": 0.68 }`. 완료 분석 공고를 모수로 집계하고 표본 수를 함께 반환한다. `dateFrom`·`dateTo`는 공고 게시일 필터, `desiredRole`은 공고 제목 필터다.

`SkillGap`: `{ "available": true, "desiredRole": "백엔드 개발자", "items": [{ "skill": Skill, "demandJobCount": 136, "requirementType": "REQUIRED", "priority": "HIGH" }] }`. 사용자·프로젝트 기술과 목표 직무·시장 요구 기술을 비교한 기본 규칙 기반 결과다. `desiredRole`은 별도 직무 엔티티 없이 공고 제목 검색에 사용한다. 기술이 전혀 없거나 비교 가능한 공고가 없으면 `available: false`, `items: []`, `reason`으로 부족한 데이터를 알린다. 우선순위는 `HIGH|MEDIUM|LOW`의 설명 가능한 구분이며 별도 AI 추천 모델이나 저장 테이블을 뜻하지 않는다.

## 7. MVP 이후

이력서·자기소개서 분석, 알림, 관리자 API, 별도 할 일 관리, 복잡한 캐릭터 기능, 의미 기반 추천, 추가 채용 출처 API는 이 명세의 MVP 엔드포인트에 포함하지 않는다. 인증 전달 방식처럼 원본 문서가 정하지 않은 운영 계약은 구현 전에 확정하고 이 문서에 반영한다.
