# DevJob REST API 명세 (MVP 구현 기준)

## 1. 상태와 공통 계약

S03~S16의 표에 있는 MVP API는 구현했다. 인증·프로필·기술·프로젝트, 저장 공고·북마크·지원, AI 분석·공고별 역량 비교·시장 기술 수요·Skill Gap·대시보드가 포함된다. 기준 문서는 `requirements.md`, `user-flow.md`, `architecture.md`, `erd.md`다. 기본 경로는 `/api`, 요청·응답 본문은 JSON이다. 외부 채용 API 수집은 Backend의 Adapter 처리 범위이며, 근거 없는 공개 수집·관리자 API를 추가하지 않는다.

- `{...Id}`는 양의 정수 식별자다. 날짜는 `YYYY-MM-DD`, 일시는 시간대가 포함된 ISO 8601 문자열로 표현한다. 값이 없는 선택 필드는 `null`로 응답한다.
- `page`·`size`를 받는 목록은 `page`(0부터 시작, 기본 0), `size`(1~100, 기본 20)를 사용하고 `{ "items": [], "page": 0, "size": 20, "totalElements": 0 }` 형태로 응답한다. 공고 `sort`는 `latest`(기본), `deadline`, `matchRate`를 허용한다. 내 기술 목록과 한 지원 건의 상태 이력은 페이지 없이 반환한다.
- 성공 응답은 아래에 적은 리소스 JSON을 직접 반환한다. 본문 없는 삭제·로그아웃은 `204 No Content`다. 공통 오류 본문은 `{ "code": "ERROR_CODE", "message": "사용자에게 표시할 설명" }`이다. 내부 예외·Secret·외부 API 원문은 노출하지 않는다.
- 인증 필요 여부의 `예`는 로그인한 사용자만 호출할 수 있다는 뜻이다. S03에서 서버 세션 + HttpOnly 쿠키 전달과 서버 세션 무효화 로그아웃을 확정했다. 프로필, 사용자 기술, 프로젝트, 북마크, 지원, 개인 분석은 각 후속 구현에서 서버가 리소스 소유권을 확인한다.
- 공통 오류: 입력 오류 `400`, 인증 없음 `401`, 소유권 없음 `403`, 대상 없음 `404`, 중복·상태 충돌 `409`, 서버 오류 `500`. 외부 연동 실패는 해당 기능에서 `502` 또는 `503`으로 표시할 수 있으며 저장된 공고·CRM 조회는 계속 가능해야 한다.

### 공통 값

- 지원 상태: `INTERESTED`, `PLANNED`, `APPLIED`, `DOCUMENT_PASSED`, `INTERVIEW`, `FINAL_PASSED`, `REJECTED`, `WITHDRAWN`.
- 공고 기술 유형: `REQUIRED`, `PREFERRED`.
- AI 분석 상태: `PENDING`, `COMPLETED`, `FAILED`. 분석 행이 아직 없는 공고는 상세에서 `analysis: null`로 표현한다. S12는 분석 요청·상태 API와 상세 기술을, S13은 공고별 역량 비교·적합도를 구현했다.
- `Skill` 응답: `{ "id": 1, "name": "PostgreSQL" }`. `JobSkill` 응답: `{ "skill": { "id": 1, "name": "PostgreSQL" }, "requirementType": "REQUIRED" }`.
- 아래 예시의 `Skill`, `JobSummary`, `Skill[]` 같은 표기는 위에서 정의한 응답 타입 참조이며 JSON 문자열 값이 아니다.
- 모든 생성·수정 요청은 필수값, 길이·형식, 참조 ID의 존재, 상태값을 검증한다. 알 수 없는 기술명을 임의 문자열로 `UserSkill`·`ProjectSkill`·`JobSkill`에 저장하지 않는다.

## 2. 인증과 프로필

S03 인증 계약:

- `JSESSIONID` 쿠키는 HttpOnly, SameSite=Lax, Path=/이며 URL로 세션 ID를 전달하지 않는다. 서버 세션은 비활동 30분 후 만료되고 서버 재시작 시 사라진다. `Secure` 기본값은 `true`; 로컬 HTTP 개발에서만 `SESSION_COOKIE_SECURE=false`를 설정한다.
- Frontend와 API는 같은 출처를 사용한다. 로컬 Vite의 `/api` proxy는 `VITE_API_PROXY_TARGET`(기본 `http://127.0.0.1:8080`)로 전달한다. 배포 시에도 `/api`를 같은 출처에서 제공해야 한다. 쿠키·비밀번호·CSRF 토큰을 localStorage/sessionStorage에 저장하지 않는다.
- 가입·로그인·로그아웃 POST 전에 `GET /api/auth/csrf`로 토큰을 받아 같은 세션 쿠키와 `X-CSRF-TOKEN` 헤더를 보낸다. CSRF 토큰 없음·불일치는 `403 FORBIDDEN`이다. 보호 API의 미인증 요청은 CSRF 유무와 관계없이 `401 UNAUTHORIZED`다. 인증 전 GET도 CSRF 준비를 위한 익명 세션을 만들 수 있으나 로그인 상태가 되지는 않는다.
- 가입은 계정만 생성하며 자동 로그인하지 않는다. 이메일은 공백 제거·소문자 정규화 후 형식·최대 254자를 검증한다. 비밀번호는 공백뿐인 값을 거부하고 8자 이상·UTF-8 최대 72바이트로 제한하며 BCrypt 해시만 저장한다. 가입·로그인의 본문 형식 오류는 `400`; 잘못된 비밀번호와 없는 계정은 같은 `401` 오류로 응답한다.
- 로그인은 세션 ID와 CSRF 토큰을 교체한다. 로그아웃은 서버 세션을 무효화하고 쿠키를 삭제한다. 이전 세션 쿠키로 재접근할 수 없으며 다른 사용자 세션에는 영향을 주지 않는다. `/me`의 사용자 ID는 서버 인증 주체에서만 얻고 입력 ID·헤더로 선택하지 않는다.
- B01 비밀번호 변경 `PATCH /api/auth/password`의 확정 요청·응답·오류는 [확장 API 명세 B01](extension-api-spec.md#b01--계정-비밀번호--ext-01-01-확정)을 따른다. 변경 성공 시 현재 세션을 종료하고 다른 세션은 저장된 인증 버전 비교로 보호 API 접근을 거절한다. 기존 로그인·로그아웃 응답 계약은 유지한다.

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| CSRF 준비 `GET /api/auth/csrf` | 아니요 | 없음 | 없음 | `{ "headerName": "X-CSRF-TOKEN", "token": "..." }` · `200` | 서버 오류 `500` |
| 회원가입 `POST /api/auth/register` | 아니요 | 없음 | `{ "email": "user@example.com", "password": "..." }` | `{ "id": 1, "email": "user@example.com" }` · `201` | 형식 오류 `400`, 이메일 중복 `409` |
| 로그인 `POST /api/auth/login` | 아니요 | 없음 | `{ "email": "...", "password": "..." }` | `{ "user": { "id": 1, "email": "..." } }` · `200` | 자격 증명 오류 `401` |
| 로그아웃 `POST /api/auth/logout` | 예 | 없음 | 없음 | 본문 없음 · `204` | 인증 없음 `401` |
| 현재 사용자 확인 `GET /api/auth/me` | 예 | 없음 | 없음 | `{ "id": 1, "email": "..." }` · `200` | 인증 없음 `401` |
| 내 프로필 조회 `GET /api/me/profile` | 예 | 없음 | 없음 | 아래 `Profile` · `200`; 프로필 미설정 시 `404` | 인증 없음 `401` |
| 내 프로필 생성·수정 `PUT /api/me/profile` | 예 | 없음 | `Profile` 입력 필드 | 아래 `Profile` · 최초 `201`, 수정 `200` | 값 오류 `400`, 인증 없음 `401`, 이메일 중복·동시 생성 충돌 `409` |

`Profile` 입력 필드: `email`, `name`, `desiredRole`, `careerLevel`, `desiredLocation`, `introduction`, `education`, `certifications`. `email`과 `name`은 필수, 나머지는 선택이다. 응답은 `{ "id": 1, "email": "user@example.com", "name": "홍길동", "desiredRole": "백엔드 개발자", "careerLevel": "신입", "desiredLocation": "서울", "introduction": null, "education": null, "certifications": null }` 형태다. 이메일은 `User.email`을 조회·갱신하고 `Profile`에 중복 저장하지 않는다. `PUT`은 같은 사용자 프로필 한 건을 생성 또는 교체하며, 선택 필드는 누락 시 `null`로 본다.

S04 구현: 이메일은 앞뒤 공백 제거·소문자 정규화 후 최대 254자와 이메일 형식을 검증한다. 이름은 공백을 제거한 필수값(최대 100자)이다. 선택 문자열은 공백뿐이면 `null`로 저장하며 희망 직무·경력 수준·희망 지역은 각 100자, 자기소개 2000자, 학력·자격증은 각 1000자까지 허용한다. 사용자 ID는 세션에서만 가져오며 요청에서 다른 사용자를 지정할 수 없다. `PUT`에도 `GET /api/auth/csrf`의 `X-CSRF-TOKEN`이 필요하다.

## 3. 기술과 프로젝트

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 표준 기술 검색 `GET /api/skills` | 예 | Query: `q`, `page`, `size` | 없음 | `Skill` 목록 · `200` | 잘못된 검색값 `400` |
| 내 기술 목록 `GET /api/me/skills` | 예 | 없음 | 없음 | `{ "items": [{ "id": 1, "name": "Java", "proficiencyLevel": null, "experienceMonths": null }] }` · `200` | 인증 없음 `401` |
| 내 기술 추가 `POST /api/me/skills` | 예 | 없음 | `{ "skillId": 1 }` 또는 `{ "name": "Postgres" }` | `Skill` · `201` | 값 오류 `400`, 기술 ID 없음 `404`, 이미 보유 `409` |
| 내 기술 숙련도·경험 수정 `PATCH /api/me/skills/{skillId}/experience` | 예 | Path: `skillId` | `{ "proficiencyLevel": 3, "experienceMonths": 24 }`의 부분 변경 | 변경된 보유 기술 · `200` | 값 오류 `400`, 인증 없음 `401`, 미보유 기술 `404` |
| 내 기술 삭제 `DELETE /api/me/skills/{skillId}` | 예 | Path: `skillId` | 없음 | 본문 없음 · `204` | 등록된 기술 없음 `404` |

B02에서 내 기술 목록의 각 항목만 `proficiencyLevel`(1~5 정수 또는 `null`)과 `experienceMonths`(0~600개월 정수 또는 `null`)를 추가한다. PATCH는 두 필드 중 하나 이상을 요구하며 누락은 값 유지, `null`은 제거다. 빈 객체·알 수 없는 필드·잘못된 타입과 범위는 `400`이다. 기존 등록 요청/응답과 공용 `Skill` 형식은 유지한다. 등록 시 두 값은 `null`, 삭제 후 재등록 시에도 `null`이며 프로젝트 기술은 자동 반영하지 않는다. 세부 예시는 [확장 API 명세 B02](extension-api-spec.md)를 따른다.
| 내 프로젝트 목록 `GET /api/me/projects` | 예 | Query: `page`, `size` | 없음 | `Project` 목록 · `200` | 잘못된 페이지 `400` |
| 내 프로젝트 등록 `POST /api/me/projects` | 예 | 없음 | 아래 `Project` 입력 | `Project` · `201` | 값 오류 `400`, 기술 없음 `404` |
| 내 프로젝트 상세 `GET /api/me/projects/{projectId}` | 예 | Path: `projectId` | 없음 | `Project` · `200` | 없음 `404`, 타인 소유 `403` |
| 내 프로젝트 수정 `PUT /api/me/projects/{projectId}` | 예 | Path: `projectId` | 아래 `Project` 입력 | `Project` · `200` | 값 오류 `400`, 없음 `404`, 타인 소유 `403` |
| 내 프로젝트 삭제 `DELETE /api/me/projects/{projectId}` | 예 | Path: `projectId` | 없음 | 본문 없음 · `204` | 없음 `404`, 타인 소유 `403` |

`Project` 입력: `{ "name": "프로젝트명", "description": "...", "startDate": "2026-01-01", "endDate": null, "role": "백엔드", "keyFeatures": "...", "outcome": "...", "projectUrl": null, "skillIds": [1, 2] }`. `name`, `startDate`, `skillIds`는 필수이고 `skillIds`는 빈 배열이 가능하다. 그 외 텍스트·URL·종료일은 선택이다. 응답에는 `id`와 입력 정보 중 `skillIds`를 제외한 필드, `skills: Skill[]`를 포함한다. 수정 시 `skillIds`는 전달한 목록으로 프로젝트 기술 관계를 교체한다. 프로젝트 기술을 수정해도 보유 기술 목록이 자동으로 변하지 않는다.

S06 구현 계약:

- 프로젝트명·역할은 최대 100자, 설명·주요 기능·성과·URL은 최대 2000자다. 문자열은 앞뒤 공백을 제거하며 선택 문자열의 공백뿐인 값·누락은 `null`이다. 텍스트의 NUL 등 제어 문자는 `400`이며 줄바꿈·탭은 허용한다. 숫자·객체를 문자열로 변환하지 않는다.
- 시작일은 필수 ISO 날짜, 종료일은 선택이며 시작일보다 빠르면 `400`이다. URL은 호스트가 있는 `http`/`https` 절대 주소만 허용하고 계정 정보가 포함된 URL은 `400`이다.
- `skillIds`는 JSON 양의 정수(Long 범위) 배열이다. 누락·null 배열·null 원소·문자열/소수/0/음수 ID는 `400`이다. 중복 ID는 하나의 관계로 저장하고, 하나라도 없는 ID이면 `404`로 전체 생성·수정을 거부한다. 선택한 기술이 UserSkill에 없어도 연결할 수 있다. 새 기술명 생성은 프로젝트 API에 포함하지 않는다.
- 목록은 생성 시각·ID 내림차순, 1절의 페이지 규칙을 사용하며 `page × size > 2147483647`은 `400`이다. 범위 밖 페이지는 빈 `items`와 실제 전체 건수를 반환한다. 상세·수정·삭제의 비양수/잘못된 ID는 `400`, 없는 프로젝트는 `404`, 다른 사용자 소유는 `403`이다.
- 사용자 ID는 S03 세션에서만 얻고 요청의 `userId`·`X-User-Id`로 바꾸지 않는다. POST·PUT·DELETE는 최신 CSRF 토큰을 요구한다. 수정은 텍스트·날짜·선택 기술을 교체하고 선택 필드 누락은 `null`로 처리한다. 삭제는 해당 Project·ProjectSkill만 제거하며 UserSkill·공통 Skill·SkillAlias를 유지한다.

기술 추가 요청은 `skillId`와 `name` 중 하나만 보낸다. `name`은 기존 표준 기술명·별칭으로 먼저 정규화하고, 일치 항목이 없으면 해당 이름의 표준 `Skill`을 생성해 연결한다. 문자열 자체를 `UserSkill`에 저장하지 않는다. 별칭 목록 관리는 공개 사용자 API 범위에 넣지 않는다.

S05 구현 계약:

- 검색 `q`는 생략 또는 빈 문자열이면 전체 목록이다. 공백만 있는 값, 100자 초과, 제어·format 문자는 `400`이다. NFKC → Unicode 공백 축약·앞뒤 제거 → `Locale.ROOT` 소문자로 표준명·별칭의 부분 문자열을 검색한다. `%`, `_`는 일반 문자이며 결과는 기술당 한 건, 정규화 이름·ID 오름차순이다. 페이지 기본값·응답은 1절을 따르며 `page × size > 2147483647`도 `400`이다.
- 추가 본문의 `skillId`는 JSON 양의 정수(Long 범위), `name`은 JSON 문자열(입력·정규화 후 모두 최대 100자)이다. 문자열 ID·소수 ID·숫자 name·빈 이름·제어/format 문자는 `400`이다. 두 값 모두 제공하거나 모두 없으면 `400`; `null`은 미선택으로 취급한다.
- `Postgres`·`POSTGRES`·`PostgreSQL`은 같은 ID의 `PostgreSQL`, `SpringBoot`는 `Spring Boot`로 연결한다. 구두점은 보존하므로 `C++`와 `C#`, `JPA`와 `Spring Data JPA`는 다른 기술이다. 알 수 없는 유효한 사용자 이름은 표준 Skill과 표준명 별칭을 생성한다. 동시 요청도 표준 키·별칭 키·보유 관계 유일 제약으로 보호한다. 같은 기술 재추가는 `409`이다.
- 모든 기술 API는 S03 세션 인증을 사용하고 POST·DELETE는 최신 CSRF 토큰을 요구한다. 내 목록·추가·삭제의 사용자 ID는 서버 `CurrentUser`에서만 얻는다. 입력 `userId`·`X-User-Id`는 사용자 선택에 사용하지 않는다. 타인만 보유한 기술을 삭제하면 내 관계가 없으므로 `404`이며 타인 데이터는 유지한다. 삭제는 UserSkill 관계만 제거하고 공통 Skill·SkillAlias는 유지한다.
- 공개 정규화·별칭 관리 API는 없다. S05의 `SkillNormalizer.resolveExisting`은 AI/외부 입력에서 기존 목록만 조회하는 경계로 남겨 둔다. S12는 사용자 결정에 따라 형식 검증을 마친 AI 기술명에 `resolveForAnalysis`를 사용해 기존 표준명·별칭을 해석하거나 유효한 새 표준 Skill·별칭을 만든다. S05 자체는 LLM/외부 호출·JobSkill 저장을 추가하지 않았다.

## 4. 채용공고, AI 분석, 역량 비교

### S08 구현 계약

- 저장된 공고만 조회하며 외부 Adapter·AI를 호출하지 않는다. 두 GET API 모두 S03 쿠키 세션 인증이 필요하다.
- 지원 Query는 `q`, `company`, `role`, `skillId`, `careerLevel`, `location`, `employmentType`, `deadlineBefore`, `minMatchRate`, `applicationStatus`, `itOnly`, `source`, `page`, `size`, `sort`다. `q`는 제목·회사명 부분 일치이며 길이가 3자 이상일 때만 저장된 본문도 검색한다. 짧은 일반 단어가 긴 설명에서 우연히 매칭되는 잡음을 줄이기 위한 기준이다. `company`·`location`은 해당 필드의 대소문자 무시 부분 일치다. `role`은 제목 기반 `DEVELOPMENT`, `DATA_AI`, `SECURITY`, `INFRA`, `IT_OPERATIONS` 중 하나이며 잘못된 값은 `400`이다. `itOnly=true`는 개발·데이터·보안·인프라·전산 제목 신호가 있는 저장 공고만 조회한다(생략 시 false, 화면 기본값 true). 제목에 직무가 드러나지 않으면 누락될 수 있다. `%`, `_`, `\`는 검색 문자 그대로 취급한다. `careerLevel`·`employmentType`은 저장된 문자열과 대소문자 무시 정확히 일치한다. `skillId`는 완료된 분석의 공고 기술과 정확히 일치할 때만 포함한다. `applicationStatus`는 현재 세션 사용자의 지원 상태로 AND 필터링하며 빈 문자열·알 수 없는 상태는 `400`이다. `source`는 `JobSource.code`와 정확히 일치하며 대문자·숫자·밑줄 형식으로 최대 100자다. 형식 오류는 `400`, 존재하지 않는 코드는 빈 결과다. 화면 선택지는 전체·`ALIO_RECRUITMENT`·`WORK24_OPEN_RECRUITMENT`다.
- 검색 문자열은 양끝 공백을 제거하고 공백뿐이면 조건을 생략한다. 각 검색 문자열은 최대 200자다. `deadlineBefore`는 유효한 `YYYY-MM-DD` 날짜이며 당일을 포함한다. 날짜가 없는 공고는 마감일 필터 결과에서 제외한다. 여러 필터는 AND로 결합한다.
- `page`는 0 이상 정수, `size`는 1~100(기본 20)이다. `page × size > 2147483647`은 `400`이다. 결과가 없거나 범위를 벗어난 페이지는 `items: []`와 조건에 맞는 전체 건수를 반환한다.
- 정렬은 `latest`(게시일 내림차순)·`deadline`(마감일 오름차순)·`matchRate`(기술 일치도 내림차순)이며 날짜·계산 불가 일치도는 뒤에 둔다. 값이 같으면 `id` 내림차순으로 안정적인 페이지 순서를 유지한다.
- `skillId`는 양의 Long, `minMatchRate`는 0~100 정수다. 잘못된 페이지·필터·식별자는 `400`, 없는 양의 공고 ID는 `404 NOT_FOUND`다.
- 기존 응답 형태를 유지하며 `bookmarked`와 `applicationStatus`는 현재 세션 사용자의 실제 저장·지원 상태다. 목록은 현재 페이지의 공고 ID에 대해 상태와 적합도를 일괄 조회하며 상세에서도 사용자별로 확인한다. 지원 미등록 시 상태는 `null`이다. 분석 전에는 `matchRate: null`, `requiredSkills: []`, `preferredSkills: []`, `analysis: null`이다. 본문이 null이어도 기본 정보와 HTTP(S) `sourceUrl`은 반환한다.

아래 표·분석 응답 설명은 후속 단계를 포함한 최종 MVP 계약이다.

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 공고 검색·필터 `GET /api/jobs` | 예 | Query: `q`, `company`, `role`, `skillId`, `careerLevel`, `location`, `employmentType`, `deadlineBefore`, `minMatchRate`, `applicationStatus`, `itOnly`, `source`, `page`, `size`, `sort` | 없음 | `JobSummary` 목록 · `200` | 필터·정렬값 오류 `400` |
| 공고 상세 `GET /api/jobs/{jobId}` | 예 | Path: `jobId` | 없음 | 아래 `JobDetail` · `200` | 공고 없음 `404` |
| AI 분석 요청·재시도 `POST /api/jobs/{jobId}/analysis` | 예 | Path: `jobId` | 없음 | `AIAnalysis` · 새 요청/진행 중 `202`, 완료 결과 재사용 `200` | 본인 북마크 없음 `403`, 공고 없음 `404`, 분석 요청 접수 실패 `503` |
| AI 분석 상태·결과 `GET /api/jobs/{jobId}/analysis` | 예 | Path: `jobId` | 없음 | 아래 `AIAnalysis` · `200` | 공고 또는 분석 행 없음 `404` |
| 내 역량과 공고 비교 `GET /api/jobs/{jobId}/match` | 예 | Path: `jobId` | 없음 | 아래 `JobMatch` · `200` | 공고 없음 `404`, 분석 미완료 `409` |

`JobSummary`: `{ "id": 10, "title": "백엔드 개발자", "company": { "id": 3, "name": "A기업" }, "source": "WORK24", "location": "서울", "careerRequirement": "신입", "employmentType": "정규직", "deadlineDate": "2026-12-31", "matchRate": null, "bookmarked": false, "applicationStatus": null, "role": "DEVELOPMENT" }`. `role`은 제목 기반 표시값이며 직무를 판별할 수 없으면 `null`이다. `matchRate`는 사용자 기술와 완료된 분석 결과가 있어 계산 가능할 때만 값이 있으며, 합격 확률이 아니다.

공고 목록의 `minMatchRate`는 0~100이며 계산 가능한 공고에만 적용하고 분석 전 공고는 해당 필터에서 제외한다. `applicationStatus`는 현재 사용자의 지원 상태로 필터링한다. `sort=matchRate`에서도 계산할 수 없는 공고는 뒤에 둔다.

`JobDetail`은 `JobSummary`의 필드에 `description`, `postedDate`, `sourceUrl`, `requiredSkills: JobSkill[]`, `preferredSkills: JobSkill[]`, `analysis: { "status": "PENDING|COMPLETED|FAILED" } | null`을 추가한다. 분석 전·실패 상태여도 원문과 기본 정보는 반환한다. `source`는 `JobSource.code`다.

청년일자리 출처(`source: "ALIO_RECRUITMENT"`)의 상세에는 `recruitment: { "steps": [{ "externalId": 1, "sortOrder": 1, "title": "서류", "openings": 2, "applicants": null, "competitionRate": null, "eventDate": null }], "attachments": [{ "externalId": 10, "sortOrder": 1, "name": "공고.pdf", "type": "A", "url": "https://..." }] }`가 추가된다. 전형 단계와 첨부파일 메타정보가 없는 ALIO 공고는 빈 배열이며 다른 출처는 `recruitment: null`이다. 첨부 URL은 HTTP(S)만 반환하고 별도 파일 다운로드 API는 없다.

`POST /api/jobs/collections/alio`는 사용자 공고 목록과 분리된 백엔드 수동 수집 요청이며 로그인 세션과 CSRF가 필요하다. 목록·상세 화면은 이 POST를 호출하지 않고 DB에 저장된 공고만 GET으로 조회한다. 선택 Query `keyword`(요청한 페이지들 안의 제목 부분 일치, 최대 100자), `page`(시작, 0~999, 기본 0), `pages`(1~3, 기본 3)를 받으며 `page + pages <= 1000`이어야 한다. 페이지당 최대 20건을 요청하고 마지막 페이지에 도달하면 멈춘다. 제공기관 요청에는 `ncsCdLst=R600020`(정보통신), `ongoingYn=Y`를 고정 적용한다. 제공기관의 한글 `recrutPbancTtl` 조회가 실제로 `resultCode="5"`를 반환하므로 제목 검색은 페이지 응답을 받은 뒤 서버에서 적용한다. 반환 행에서 NCS 코드와 개발·데이터·보안·인프라 제목 신호를 다시 확인한 뒤 해당 공고만 상세 조회·저장한다. 직무가 상세/첨부에만 나타나는 일반 제목 공고는 누락될 수 있다. `200` 응답은 `{ "status": "COMPLETED|PARTIAL_FAILURE|SOURCE_FAILED|STORAGE_FAILED", "created": 0, "duplicates": 0, "rejected": 0, "failed": 0, "sourceError": null }` 형태다. IT 범위 밖 행은 저장 시도 전 제외하므로 `rejected`에 포함하지 않는다. `SOURCE_FAILED`의 `sourceError`는 `PROVIDER_CONNECTION`(제공기관 `resultCode=5`), `AUTHENTICATION`(7), `APPROVAL`(8), `PROVIDER_ERROR`, `REQUEST_FAILED`, `INVALID_RESPONSE`, `NOT_CONFIGURED` 중 하나 또는 null이다. 키·요청 URL·제공기관 원문은 응답하지 않는다. 자동 수집과 자동 재시도는 없다.
ALIO 재수집으로 제목이나 분석 입력 텍스트가 달라지면 이전 완료 분석은 `FAILED`로 무효화되고 추출 기술은 삭제된다. 사용자가 기존 분석 POST를 다시 호출하면 변경된 공고를 재분석한다.

`AIAnalysis`: `{ "status": "COMPLETED", "requiredSkills": [Skill], "preferredSkills": [Skill], "analyzedAt": "2026-10-05T10:00:00+09:00" }`. `PENDING`에는 기술 목록을 빈 배열로, `FAILED`에는 기술 목록을 빈 배열과 일반적인 `failureReason`을 반환한다. 검증되지 않은 LLM 원문이나 Secret은 반환하지 않는다. 이미 완료된 결과는 다시 호출하지 않고 재사용한다. 실패 상태에서 다시 POST하면 같은 분석 대상을 재시도한다.

S12 구현 계약: `POST`는 서버 세션·CSRF가 필요하며 작업을 비동기로 접수해 `202 PENDING`을 반환한다. 이미 진행 중인 요청도 같은 행의 `202 PENDING`, 완료 결과는 추가 호출 없이 `200 COMPLETED`다. `GET`은 행이 없으면 `404`; 실패 시 `FAILED`, 빈 기술 배열, 일반적인 `failureReason`을 반환한다. `analyzedAt`과 `failureReason`은 상태에 맞지 않으면 `null`이다. 5분 넘게 진행 중인 행은 다음 명시적 `POST`에서 재접수할 수 있다. 출력은 단일 `skills` 배열(JSON 객체)이며 항목은 기술명과 `REQUIRED`/`PREFERRED` 유형만 허용한다. 검증된 미등록 기술은 공통 Skill·표준명 별칭으로 생성하고 정규화된 ID를 저장한다. 같은 기술이 중복되면 `REQUIRED`가 우선한다. 분석 실패는 공고 상세·목록과 북마크·지원 API의 조회를 막지 않는다.

`JobMatch`: `{ "available": true, "required": { "matched": [Skill], "missing": [Skill], "total": 4 }, "preferred": { "matched": [Skill], "missing": [Skill], "total": 2 }, "matchRate": 83 }`. `UserSkill`과 사용자의 `ProjectSkill`을 합친 기술 집합으로 비교한다. `matchRate`는 `(일치한 필수 + 일치한 우대) / (전체 필수 + 전체 우대) × 100`을 반올림한 0~100 값이다. 공고에 분석된 기술이 전혀 없거나 사용자·프로젝트 양쪽에 기술이 없으면 `available: false`, 각 목록은 빈 배열, `matchRate: null`, `reason: "NO_JOB_SKILLS"` 또는 `"USER_SKILLS_EMPTY"`로 응답한다.

S13 구현: 비교 API는 완료된 분석이 없으면 `409 CONFLICT`를 반환한다. 기술은 공통 Skill ID로 중복 제거하고 필수·우대를 합산해 일치도를 계산한다. 목록·상세의 `matchRate`는 분석이 완료됐고 공고 기술과 사용자·프로젝트 기술이 모두 있을 때만 채운다. `minMatchRate`는 반올림한 일치도에 적용하며, `sort=matchRate`에서는 계산 불가 공고를 마지막에 둔다. 필터·정렬은 페이지를 자르기 전에 적용한다.

## 5. 북마크와 지원 관리

### S10 구현 계약

- 세 북마크 API 모두 S03 쿠키 세션 인증을 사용한다. POST·DELETE는 최신 `X-CSRF-TOKEN`이 필요하며 인증 없음은 `401`, CSRF 없음·불일치는 `403`이다. 사용자 ID는 서버 `CurrentUser`에서만 얻고 본문·Query의 `userId`나 `X-User-Id`로 소유자를 선택하지 않는다.
- POST의 `jobId`는 필수 JSON 양의 정수(Long 범위)다. 누락·null·문자열·소수·범위 초과는 `400 INVALID_INPUT`, 없는 공고는 `404 NOT_FOUND`, 이미 저장된 사용자·공고는 `409 CONFLICT`다. 동시 저장도 유일 제약과 `ON CONFLICT`로 같은 결과를 유지한다.
- 목록은 공통 `page`·`size` 계약을 따르고 `page × size > 2147483647`은 `400`이다. 저장 시각 내림차순·동률 ID 내림차순으로 정렬하며 빈 목록·범위 밖 페이지는 `items: []`와 정확한 `totalElements`를 반환한다. 마감된 공고와 마감일 없는 공고도 유지한다. 모든 반환 Bookmark의 `job.bookmarked`는 `true`다.
- DELETE 경로는 **공고 ID**이며 북마크 ID가 아니다. 현재 사용자의 관계만 삭제하고 공고·타인 관계를 보존한다. 없는 관계·타인만 저장한 관계는 `404`; 잘못된 ID는 `400`이다. 성공은 `204`다. 북마크는 지원·AI와 독립적이며 외부 API·LLM을 호출하지 않는다.

### S11 구현 계약

- 지원 목록은 세션 사용자만 조회하고 1절 페이지 응답을 사용한다. `status`는 정확한 상태값이며 잘못된 값·빈 값은 `400`이다. 정렬은 등록 시각·ID 내림차순이다. 이력은 변경 시각·ID 오름차순으로 페이지 없이 반환한다.
- 생성·상태 변경의 `status`는 필수 JSON 문자열이다. 생성 시 양의 JSON 정수(Long 범위) `jobId` 또는 `personalSavedJobId` 중 정확히 하나를 보낸다. 개인 관심공고는 현재 사용자가 소유한 활성 공고여야 하며 다른 사용자 공고는 `404`다. 초기 상태 3개 이외의 생성은 `400`이다. `APPLIED` 생성·전이에만 유효한 `appliedDate`가 필수이며 다른 상태 요청에서는 생략 또는 `null`로 보낸다. 이후 전이에서 기존 지원일은 유지한다. 날짜는 연도 0001~9999의 `YYYY-MM-DD`, 일정은 시간대가 포함된 ISO 8601이며 응답 일정은 UTC로 정규화한다.
- `note`는 선택 JSON 문자열(최대 2000자); 양끝 공백 제거, 공백뿐이면 `null`이다. 줄바꿈·탭 이외 제어 문자는 거부한다. `PATCH` 메모·일정은 누락 필드를 유지하고 명시적 `null`은 비운다. 빈 객체·알 수 없는 필드·잘못된 JSON 타입은 `400`이다. 이 경로로 상태·지원일·사용자·공고를 변경할 수 없다.
- 모든 변경 요청은 최신 CSRF 토큰이 필요하다. 사용자 ID는 세션에서만 얻으며 타인 소유 상세·수정·상태·이력은 `403`, 없는 지원은 `404`다. 중복 생성은 출처별 `(user_id, job_posting_id)` 또는 `(user_id, personal_saved_job_id)` 유일 키로 `409`를 보장한다.
- 초기 상태와 실제 상태 변경마다 이력을 같은 트랜잭션에 저장한다. 메모·일정 변경은 이력을 만들지 않는다. 수정·전이는 지원 행 잠금으로 직렬화하고 최신 상태로 전이를 검증한다. 같은 상태·건너뛰기·역행·종료 상태 전이는 `409`이며 이력이 추가되지 않는다.

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 관심 공고 목록 `GET /api/bookmarks` | 예 | Query: `page`, `size` | 없음 | `Bookmark` 목록 · `200` | 페이지 오류 `400`, 인증 없음 `401` |
| 관심 공고 저장 `POST /api/bookmarks` | 예 | 없음 | `{ "jobId": 10 }` | `Bookmark` · `201` | 공고 없음 `404`, 이미 저장 `409` |
| 관심 공고 삭제 `DELETE /api/bookmarks/{jobId}` | 예 | Path: `jobId` | 없음 | 본문 없음 · `204` | 저장 기록 없음 `404` |
| 내 지원 목록 `GET /api/applications` | 예 | Query: `status`, `page`, `size` | 없음 | `Application` 목록 · `200` | 상태값 오류 `400` |
| 지원 등록 `POST /api/applications` | 예 | 없음 | `{ "jobId": 10, "status": "PLANNED", "appliedDate": null, "note": null, "nextScheduleAt": null }` | `Application` · `201` | 공고 없음 `404`, 중복 `409`, 상태값 오류 `400` |
| 지원 상세 `GET /api/applications/{applicationId}` | 예 | Path: `applicationId` | 없음 | `Application` · `200` | 없음 `404`, 타인 소유 `403` |
| 지원 메모·일정 수정 `PATCH /api/applications/{applicationId}` | 예 | Path: `applicationId` | `{ "note": "...", "nextScheduleAt": "2026-10-10T14:00:00+09:00" }` 중 변경할 필드 | `Application` · `200` | 값 오류 `400`, 없음 `404`, 타인 소유 `403` |
| 지원 상태 변경 `PATCH /api/applications/{applicationId}/status` | 예 | Path: `applicationId` | `{ "status": "APPLIED", "appliedDate": "2026-10-05" }` | `Application` · `200` | 허용되지 않은 전이·동일 상태 `409`, 값 오류 `400`, 없음 `404`, 타인 소유 `403` |
| 지원 상태 이력 `GET /api/applications/{applicationId}/history` | 예 | Path: `applicationId` | 없음 | `ApplicationStatusHistory[]` · `200` | 없음 `404`, 타인 소유 `403` |

`Bookmark`: `{ "id": 1, "job": JobSummary, "createdAt": "..." }`. `Application`: `{ "id": 1, "job": JobSummary | null, "personalSavedJob": PersonalSavedJob | null, "currentStatus": "PLANNED", "appliedDate": null, "nextScheduleAt": null, "note": null, "createdAt": "...", "updatedAt": "..." }`. 두 공고 필드 중 하나만 값이 있다. `ApplicationStatusHistory`: `{ "id": 1, "fromStatus": null, "toStatus": "PLANNED", "changedAt": "..." }`. 지원 생성 시 초기 상태는 `INTERESTED`, `PLANNED`, `APPLIED` 중 하나이며 최초 상태도 이력에 남긴다. `APPLIED`로 생성하거나 변경할 때 `appliedDate`를 입력해 실제 지원일을 기록한다. 상태 전이는 `INTERESTED → PLANNED → APPLIED → DOCUMENT_PASSED → INTERVIEW → FINAL_PASSED`를 기본으로 하고, `INTERESTED`·`PLANNED`·`APPLIED`에서 `WITHDRAWN`, `APPLIED`·`DOCUMENT_PASSED`·`INTERVIEW`에서 `REJECTED`를 허용한다. 종료 상태에서는 추가 전이를 허용하지 않는다. 북마크와 지원은 서로 독립적으로 생성·삭제된다.

### 개인 관심공고 계약

`POST /api/me/saved-jobs`는 `url`(HTTP(S), 호스트 필수, 사용자 정보·fragment 없음, 최대 2048자), `companyName`(1~200자), `title`(1~300자)을 필수로 받는다. 선택 필드는 `role`·`careerLevel`·`employmentType` 각 최대 120자, `location` 최대 200자, `deadlineDate` 유효한 `YYYY-MM-DD`, `note` 최대 2000자, AI 입력용 `description` 최대 12000자다. 등록 응답은 `PersonalSavedJob`과 `201`; `GET /api/me/saved-jobs/{id}`는 소유한 활성 개인 공고만 `200`; `PUT /api/me/saved-jobs/{id}`는 같은 전체 필드로 수정해 `200`; `DELETE /api/me/saved-jobs/{id}`는 목록에서 숨기고 `204`를 반환한다. 로그인·변경 요청 CSRF가 필요하다. 잘못된 값은 `400`, 존재하지 않거나 타인 소유인 공고는 `404`, 같은 사용자의 활성 동일 URL은 `409`다. 삭제한 공고의 기존 지원 기록은 유지한다. 개인 공고는 `JobPosting`·`JobSource`로 만들지 않는다.

`GET /api/me/saved-jobs?page=0&size=20`은 기존 북마크와 활성 개인 공고를 저장 시각순으로 통합 페이지 처리한다. `{items,page,size,totalElements}`의 각 항목은 `kind: "COLLECTED" | "MANUAL"`, `id`, `jobId`(개인 공고는 null), `url`, `companyName`, `title`, `role`, `careerLevel`, `location`, `employmentType`, `deadlineDate`, `note`, `description`(수집 공고는 null), `source`(개인 공고는 `DIRECT`), `applicationStatus`, `analysisStatus`, `createdAt`이다. 분석 상태가 있으면 기존 수집 공고 분석 GET 또는 개인 공고 분석 GET으로 필수·우대 기술을 조회한다. 기존 `/api/bookmarks` 계약은 유지한다. 개인 URL과 나중에 수집된 공고 URL이 같아도 자동 병합하지 않는다.

개인 공고 `POST /api/me/saved-jobs/{id}/analysis`는 현재 사용자가 소유한 활성 공고와 비어 있지 않은 `description`을 요구한다. 명시적 요청 한 번에 붙여넣은 본문으로 동기 분석하고 정규화·검증된 기술명 배열을 개인 분석 행에 저장해 `200`으로 반환한다. 완료 결과는 재사용하고 실패 시 `FAILED`와 일반 오류를 저장한다. `GET /api/me/saved-jobs/{id}/analysis`는 저장 결과만 반환하며 분석 행이 없으면 `404`다. 두 응답은 `{status, requiredSkills: string[], preferredSkills: string[], analyzedAt, failureReason}`다. 타인·삭제된 공고는 `404`, 본문 없음은 `400`, AI 키 미설정은 `503`, 수정 중 입력 변경은 `409`다. 개인 공고 제목·본문 수정은 이전 분석을 무효화한다. 외부 URL은 자동으로 읽지 않으며 기존 공용 기술·일치도 통계에 개인 분석을 섞지 않는다.

## 6. 대시보드와 분석

| 목적 / Method·URL | 인증 | Path / Query | Request Body | 성공 Response Body·Status | 주요 오류 |
| --- | --- | --- | --- | --- | --- |
| 내 대시보드 `GET /api/dashboard` | 예 | 없음 | 없음 | 아래 `Dashboard` · `200` | 인증 없음 `401`, 서버 집계 오류 `500` |
| 시장 기술 수요 `GET /api/analytics/skills` | 예 | Query: `dateFrom`, `dateTo`, `desiredRole`, `page`, `size` | 없음 | 아래 `SkillDemand` 목록 · `200` | 기간 오류 `400` |
| 내 기본 Skill Gap·학습 우선순위 `GET /api/me/skill-gap` | 예 | Query: `desiredRole`(선택) | 없음 | 아래 `SkillGap` · `200` | 인증 없음 `401`, 필터 오류 `400` |

`Dashboard`: `{ "applicationCounts": { "PLANNED": 1, "APPLIED": 2, "INTERVIEW": 0 }, "bookmarkCount": 3, "nextActions": [{ "applicationId": 1, "jobId": 10, "status": "PLANNED", "nextScheduleAt": null }], "recommendedJobs": [JobSummary], "skillGapPreview": [Skill] }`. `nextActions`는 지원 상태·일정에서 도출하는 표시용 항목이며 별도 자유 입력·완료 체크 기능을 뜻하지 않는다. 추천 공고는 기본 규칙 기반 적합도만 사용하며 합격 확률을 의미하지 않는다. 데이터가 없거나 분석이 미완료면 해당 배열은 비어 있다.

`SkillDemand`: `{ "skill": Skill, "jobCount": 136, "analyzedJobCount": 200, "ratio": 0.68 }`. 완료 분석 공고를 모수로 집계하고 표본 수를 함께 반환한다. S14 응답은 `{ "items": [SkillDemand], "page": 0, "size": 20, "totalElements": 12, "analyzedJobCount": 200 }`이며 기술 건수 내림차순, 기술명·ID 오름차순으로 정렬한다. `dateFrom`·`dateTo`는 공고 게시일의 양 끝을 포함하고, `desiredRole`은 공고 제목의 대소문자 무시 부분 일치 필터다. 날짜가 없는 공고는 기간 필터가 있을 때 제외한다. 필터는 선택 사항이며 `page`는 0부터, `size`는 기본 20·최대 100이다. 기간 역전·잘못된 날짜·페이지 값·200자를 넘는 직무명은 `400`이다. 조건에 맞는 분석이 없으면 `items: []`, `totalElements: 0`, `analyzedJobCount: 0`을 반환한다.

`SkillGap`: `{ "available": true, "desiredRole": "백엔드 개발자", "analyzedJobCount": 100, "provisional": false, "totalMissingSkills": 8, "items": [{ "skill": Skill, "demandJobCount": 82, "requiredJobCount": 74, "preferredJobCount": 8, "demandRatio": 0.82, "priorityScore": 78.0 }], "reason": null }`. 사용자·프로젝트 기술의 합집합에 없는 기술만 반환한다. `desiredRole` 요청값을 우선 사용하고 없으면 프로필 희망 직무를 사용한다. 둘 다 없으면 모든 완료 분석 공고를 비교한다. 직무명은 S14와 같이 공고 제목의 대소문자 무시 부분 일치이며 200자 초과는 `400`이다. `analyzedJobCount`는 해당 조건의 완료 분석 공고 수, `demandJobCount = requiredJobCount + preferredJobCount`, `demandRatio = demandJobCount / analyzedJobCount`, `priorityScore = 100 × (requiredJobCount + 0.5 × preferredJobCount) / analyzedJobCount`다. 점수 내림차순, 등장 건수 내림차순, 기술명·ID 오름차순으로 정렬한 부족 기술 상위 5개를 `items`에 반환하고 전체 부족 기술 수를 `totalMissingSkills`로 반환한다. 점수는 순위 계산용이며 화면에는 노출하지 않는다. 완료 분석 공고가 5건 미만이면 `available: false`, `items: []`, `reason: "INSUFFICIENT_SAMPLE"`로 순위를 보류한다. 5~19건이면 `provisional: true`로 표본 부족을 알리고 20건 이상이면 `false`다. 보유 기술이 없으면 `USER_SKILLS_EMPTY`, 비교 가능한 공고 기술이 없으면 `NO_JOB_SKILLS`를 `reason`으로 반환한다. 데이터 부족 시 `totalMissingSkills: 0`, `provisional: false`다. 등급·별도 결과 테이블·AI 추천 모델은 사용하지 않는다.

S16 대시보드 선정 기준: `applicationCounts`에는 모든 지원 상태의 사용자별 건수를 0을 포함해 반환한다. `nextActions`는 종료 상태를 제외한 지원 중 일정이 빠른 순(일정 없는 건은 ID 순) 상위 5건이다. `recommendedJobs`는 분석 완료 공고 중 기술 적합도가 0보다 크고 마감되지 않았으며 사용자가 아직 지원하지 않은 공고를 적합도 내림차순·마감일 오름차순·ID 내림차순으로 최대 3건 반환한다. 사용자 기술이나 완료 분석이 없으면 빈 배열이다. `skillGapPreview`는 기본 희망 직무에 대한 사용자의 부족 기술 상위 5개이며 S15 기준상 순위를 보류하면 빈 배열이다. 조회 과정에서 외부 AI·채용 API를 호출하지 않는다.

`nextActions`의 각 항목에는 표시용 `jobTitle`도 포함한다.

## 7. MVP 이후

이력서·자기소개서 분석, 알림, 별도 할 일 관리, 캐릭터 성장, 의미 기반 추천, 추가 채용 출처 등은 이 명세의 **구현 완료 MVP 엔드포인트**에 포함하지 않는다. EXT-01~08 전체의 Backend 구현 순서는 [확장 Backend 로드맵](extension-backend-roadmap.md), 후보 API와 단계별 계약 확정 항목은 [확장 API 명세 준비본](extension-api-spec.md)을 따른다. 후보 경로는 아직 구현된 계약이 아니며, 각 단계의 정책·ERD·요청/응답/오류를 확정한 뒤 이 문서와 코드에 함께 반영한다. 관리자 API는 현 확장 요구사항에도 없다. S03 인증 전달·로그아웃 계약은 2절에 반영했다.
