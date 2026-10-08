# DevJob 확장 REST API 명세 준비본

상태: **B03 확정·구현, 다른 단계는 계약 초안** · 2026-10-08

## 1. 사용 방법과 계약 상태

이 문서는 [확장 요구사항](extension-requirements.md) EXT-01~08 **전체**를 Backend부터 순차 구현하기 위한 API 목록이다. 단계 순서는 [Backend 로드맵](extension-backend-roadmap.md)을 따른다. B03 이외의 경로는 **후보**이며 구현 완료 API로 간주하지 않는다. 각 단계 착수 전에 정책을 확정하고, 해당 표를 `확정` 상태의 필드·형식·오류·예시까지 갱신한 다음 코드를 작성한다. 정책이 결정되지 않은 필드는 추측해 DTO·DB에 추가하지 않는다.

기존 구현 API의 단일 기준은 [MVP API 명세](api-spec.md) 1~6절이다. 기존 경로와 응답 필드를 임의로 바꾸지 않는다. 확장에서 기존 응답에 필드를 더할 때도 기존 클라이언트 영향과 `null`/미입력/하위 호환을 명시한다. 새 API는 `/api`를 사용하며 인증 사용자 ID는 세션에서만 얻는다. JSON 본문, CSRF, 공통 오류 `{code,message}`, 날짜·시간대, 페이지 형식과 상태 코드는 기존 명세를 따른다. `POST`·`PUT`·`PATCH`·`DELETE`는 CSRF 보호 대상이다. 개인 리소스는 본인 소유권을 검증한다. 타인 리소스에 대한 `403`/`404` 구분은 기존 기능의 노출 정책과 맞춰 단계별로 확정한다.

### 단계별 계약 확정 체크리스트

각 후보 API를 `확정`으로 바꾸기 전에 아래를 한 표에 작성한다.

1. Method·URL·인증·CSRF, path/query의 이름·기본값·허용 범위·정렬·페이지.
2. 요청 DTO의 필수/선택, 타입, 길이, 정규화, `null`·누락·빈 문자열 의미와 실제 JSON 예시.
3. 성공 코드와 응답 DTO의 필드·타입·`null` 의미, 목록 순서와 페이지, 재요청/중복 요청 결과.
4. 잘못된 입력 `400`, 미인증 `401`, 접근 거부 `403`/대상 없음 `404`, 중복·상태 충돌 `409`, 외부 장애 `502`/`503`의 구체적 오류 코드·메시지.
5. 생성·수정·삭제의 데이터 보존, 기존 API의 응답/집계/인증에 미치는 영향, 트랜잭션·동시성·멱등성.
6. 소유권, 경계값, 재조회, 오류, 외부 장애 격리, 기존 API 회귀 테스트 시나리오.

### B00 공통 계약 기준

B00은 새 엔드포인트를 확정하거나 구현하지 않는다. 아래 기준은 [MVP API 명세 1~2절](api-spec.md)의 **기존 계약**이며 B01~B15에서 해당 리소스의 세부 계약을 확정할 때 유지한다.

| 경계 | 기존 계약과 확인 대상 |
| --- | --- |
| 인증·소유권 | `/api/auth/csrf` GET과 가입·로그인 POST만 미인증 허용; 나머지는 서버 세션의 `CurrentUser`로 사용자 식별. 개인 기록은 소유권을 확인하며 타인 리소스의 `403`/`404` 구분은 기존 도메인 정책에 맞춰 해당 단계에서 확정. 공통 공고·기술·출처는 개인 소유 기록과 분리. |
| CSRF·세션 | `POST`·`PUT`·`PATCH`·`DELETE`에 같은 세션의 `X-CSRF-TOKEN` 필요. 보호 API 미인증은 `401 UNAUTHORIZED`, 인증된 요청의 CSRF 없음·불일치는 `403 FORBIDDEN`. 로그인 때 세션 ID·토큰을 교체하고 로그아웃 때 서버 세션을 무효화. |
| 입력·오류 | JSON 입력의 누락·형식 오류는 `400 INVALID_INPUT`; 없는 대상 `404 NOT_FOUND`, 중복·상태 충돌 `409 CONFLICT`. 오류 본문은 `{ "code": "...", "message": "..." }`이며 내부 예외·Secret·외부 응답 원문을 노출하지 않음. 외부 연동 장애는 해당 기능의 `502`/`503`으로 격리. |
| 목록·재조회 | 페이지 목록은 기본 `page=0`, `size=20`, 허용 `page≥0`, `1≤size≤100`과 `{ "items": [], "page": 0, "size": 20, "totalElements": 0 }` 형식. 정렬·필터·빈 결과·초과 페이지는 각 API에서 명시. 생성·변경 후 저장된 결과와 재조회가 일치해야 하며 중복·동시 요청은 해당 단계에서 결정한 유일 키·상태 전이로 검증. |
| 외부 의존·수치 | 저장된 공고·CRM 조회는 외부 채용 API나 AI의 성공에 의존하지 않음. 통계·추천·성장 수치의 모수·미상·한계는 각 해당 단계에서 확정하며 기존 `matchRate`·Skill Gap의 의미를 임의로 변경하지 않음. |

이 표는 공통 기준의 확인 결과이며 B01~B15의 후보 API 필드·오류 정책을 확정한 것으로 간주하지 않는다. B00은 데이터 구조를 바꾸지 않으므로 [ERD](erd.md)의 새 테이블이나 migration도 없다. 정책 결정 대기 목록과 선행 조건은 [Backend 로드맵](extension-backend-roadmap.md#착수-전-결정표)에 둔다.

## 2. 단계별 API 후보와 확정할 계약

후보 표의 `필수 응답`은 프론트 연결에 필요한 최소 정보이며, **아직 확정 DTO가 아니다**. B03의 확정 계약은 아래 별도 절을 따른다. 다른 단계는 확정 전 API 문서와 ERD를 함께 갱신한다. 기존 GET을 확장할 경우 현재 응답 필드를 제거하지 않는다.

### B01 · 계정 비밀번호 — EXT-01-01 (확정)

| Method·URL | 인증/CSRF | 요청 | 성공 | 오류 |
| --- | --- | --- | --- | --- |
| `PATCH /api/auth/password` | 세션 인증과 같은 세션의 `X-CSRF-TOKEN` 필수 | `{ "currentPassword": "old-password", "newPassword": "new-password" }` | `204 No Content`, 본문 없음, 현재 세션 무효화 및 쿠키 삭제 | 누락·형식·새 비밀번호 규칙 위반·현재 비밀번호와 동일 `400 INVALID_INPUT`; 미인증 또는 현재 비밀번호 불일치 `401 UNAUTHORIZED`; CSRF 없음·불일치 `403 FORBIDDEN` |

두 값은 JSON 문자열이며 `null`·누락·빈 값은 `400`이다. `currentPassword`는 공백뿐인 값과 UTF-8 72바이트 초과를 거절한다. `newPassword`는 가입과 동일하게 공백뿐인 값 금지, 8자 이상, UTF-8 72바이트 이하이며 앞뒤 공백을 임의 제거하지 않는다. 현재 비밀번호는 저장된 BCrypt 해시와 대조한다. 과거 비밀번호 이력은 검사하지 않는다. 요청의 사용자 ID를 받지 않으며 세션의 사용자 ID만 사용한다. 원문·해시를 응답이나 로그에 포함하지 않는다.

성공하면 해시와 `credential_version`을 하나의 잠금 트랜잭션에서 갱신한다. 현재 세션을 로그아웃시키고 다른 세션은 다음 보호 API 요청에서 버전 불일치로 `401 UNAUTHORIZED`가 된다. 변경 전 세션의 CSRF 토큰은 재사용할 수 없으며 재로그인 후 `GET /api/auth/csrf`로 새 토큰을 받는다. 같은 사용자의 동시 변경은 사용자 행 잠금 순서로 재검증하므로 오래된 현재 비밀번호를 사용한 후속 요청은 `401`이다. 실패 시 해시·버전·세션은 유지한다. 새 데이터 테이블이나 외부 호출은 없다.

### B02 · 기술 숙련도·경험 — EXT-02 (확정)

| Method·URL | 요청 | 성공 응답 |
| --- | --- | --- |
| `GET /api/me/skills` | 없음 | `200` `{ "items": [{ "id": 1, "name": "Java", "proficiencyLevel": null, "experienceMonths": null }] }`; 기존 정렬 유지 |
| `PATCH /api/me/skills/{skillId}/experience` | 아래 부분 변경 객체 | `200` `{ "id": 1, "name": "Java", "proficiencyLevel": 3, "experienceMonths": 24 }` |

`proficiencyLevel`은 `1`~`5`의 JSON 정수, `experienceMonths`는 `0`~`600`의 JSON 정수다. 두 값은 각각 선택 사항이며 `{ "proficiencyLevel": 3, "experienceMonths": 24 }`처럼 함께 보낼 수 있다. 필드 누락은 기존 값 유지, 명시적 `null`은 해당 값 제거다. 최소 한 필드를 보내야 하며 빈 객체·알 수 없는 필드·소수·문자열·불리언·범위 밖 값은 `400 INVALID_INPUT`이다. 경로 ID가 양수가 아니어도 `400 INVALID_INPUT`이다. 미인증은 `401 UNAUTHORIZED`, 본인이 보유하지 않은 기술 ID는 `404 NOT_FOUND`다. 쓰기 요청은 기존 세션·CSRF 규칙을 따른다.

기존 `POST /api/me/skills`의 선택 입력 `{ "skillId": 1 }` 또는 `{ "name": "Java" }`와 `201` `Skill` 응답은 유지한다. 새 보유 관계의 두 값은 `null`이다. 기존 `DELETE /api/me/skills/{skillId}`는 해당 사용자 관계와 두 값을 함께 제거하고 `204`를 반환한다. 삭제 후 재등록하면 이전 값은 복원하지 않는다. `GET /api/skills`와 다른 API의 `Skill` `{id, name}` 형식은 유지한다. 프로젝트 기술은 자동으로 보유 기술이 되지 않으며 기존 공고 적합도·Skill Gap 계산도 바뀌지 않는다.

### B03 · 개인 할 일 — EXT-03 (확정)

모든 경로는 세션 인증이 필요하고 변경 요청은 CSRF 토큰이 필요하다. 식별자는 양의 정수다. 타인 소유의 활성 할 일은 `403 FORBIDDEN`, 없는 ID와 삭제된 ID는 `404 NOT_FOUND`다. 오류 본문은 공통 `{code,message}`다. 목록은 `page=0`, `size=20`이 기본이고 `page≥0`, `1≤size≤100`을 허용한다. 페이지 오프셋 오버플로·잘못된 필터·ID·JSON은 `400 INVALID_INPUT`이다.

| Method·URL | 요청 | 성공 |
| --- | --- | --- |
| `GET /api/me/todos` | 선택 `completed=true|false`, `page`, `size`; 필터 생략 시 완료·미완료 모두 | `200` `{items:[Todo],page,size,totalElements}`. 활성 항목만, 기한 빠른 순·기한 없음 마지막·ID 내림차순. 범위 초과 페이지는 빈 `items`와 실제 총수 |
| `POST /api/me/todos` | `{ "title":"지원서 검토", "description":"오탈자 확인", "dueAt":"2026-10-15T18:00:00+09:00", "dueTimeZone":"Asia/Seoul" }` | `201` 생성된 `Todo` |
| `GET /api/me/todos/{todoId}` | 없음 | `200` `Todo` |
| `PATCH /api/me/todos/{todoId}` | 변경할 필드만 담은 비어 있지 않은 JSON 객체 | `200` 변경된 `Todo` |
| `PATCH /api/me/todos/{todoId}/completion` | `{ "completed": true }` 또는 `false` | `200` `Todo`; 같은 상태의 재요청은 `completedAt`·`updatedAt`을 유지 |
| `DELETE /api/me/todos/{todoId}` | 없음 | `204` 본문 없음; `deletedAt`을 저장하고 일반 조회에서 숨김. 반복 삭제는 `404` |

`Todo`는 `{id,title,description,dueAt,dueTimeZone,completed,completedAt,createdAt,updatedAt}`이다. 제목은 trim 후 1~200자 필수, 설명은 trim 후 최대 2000자이며 생략·`null`·공백은 `null`로 저장한다. 기한은 `dueAt` ISO 8601 오프셋 날짜·시각과 IANA `dueTimeZone`을 둘 다 보내거나 둘 다 생략/`null`로 보낸다. 입력 오프셋이 해당 시간대의 실제 오프셋과 다르면 `400`이다. 응답 `dueAt`은 저장된 시점을 지정 시간대의 오프셋으로 돌려준다. 생성 시 `completed=false`, `completedAt=null`이다. `PATCH`에서 제목 `null`·공백은 `400`, 설명 `null`은 제거, 기한은 두 필드를 `null`로 보내 제거한다. 알 수 없는 수정 필드와 빈 객체는 `400`이다. 완료 취소는 `completedAt=null`로 돌린다. 텍스트의 제어문자는 허용하지 않는다.

시각은 DB의 마이크로초 정밀도에 맞춰 저장·응답한다. 따라서 더 세밀한 소수 초가 들어오면 마이크로초로 내림한 값이 첫 응답과 재조회에 동일하게 나타난다.

`GET /api/dashboard`는 기존 필드와 함께 별도 `personalTodos: [Todo]`를 반환한다. 삭제되지 않은 미완료 할 일 중 위 기한 순 상위 5건이다. `nextActions`는 계속 지원 기록에서 계산하며 두 목록을 합치거나 서로 변환하지 않는다. 대시보드 조회는 외부 API를 호출하지 않는다. B10 EXP/보상 연동은 이 계약의 범위 밖이며 후속 정책 결정이 필요하다.

### B04 · 기업 관리 — EXT-05-01

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET/POST /api/me/companies` | 목록·생성 → 사용자별 기업 기록, 메모·상태 | 식별·중복 규칙, 공고 회사와 연결 기준 |
| `GET/PATCH/DELETE /api/me/companies/{companyId}` | 상세·수정·삭제 → 본인 기록 | 삭제와 연결 공고의 처리, 필드 제한 |

동명 기업을 이름만으로 합치지 않는다. 기존 공용 `Company`와 사용자 기록을 같은 리소스로 취급할지 여부는 ERD 확정 시 결정한다.

### B05 · 이력서 관리 — EXT-05-02

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET/POST /api/me/resumes` | 목록·생성 → 이력서 식별자/제목/최신 버전 | 텍스트·파일 입력 방식, 파일 제한 |
| `GET/PATCH/DELETE /api/me/resumes/{resumeId}` | 상세·메타데이터 변경·삭제 | 삭제/보존 정책, 분석 결과 처리 |
| `GET/POST /api/me/resumes/{resumeId}/versions` | 버전 목록·생성 → 버전 식별자/시각 | 새 버전 생성과 기존 버전 수정의 구분 |
| `GET /api/me/resumes/{resumeId}/versions/{versionId}` | 없음 → 해당 버전의 허용된 내용 | 민감 내용 노출·다운로드 범위 |

텍스트 방식이면 JSON 계약, 파일 방식이면 업로드·검증·보관·다운로드 계약을 별도로 확정한다. 둘을 동시에 허용할지 먼저 결정한다. 자기소개서가 독립 저장 리소스인지 B12 입력인지도 B05·B12 사이에 확정한다.

### B06 · 면접 일정 — EXT-05-03

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET/POST /api/me/interviews` | 목록·생성 → 일정 ID, 시간대 포함 시작 시각, 상태, 지원 연결 | 지원 ID 필수 여부, 일정 충돌 기준 |
| `GET/PATCH /api/me/interviews/{interviewId}` | 상세·일정 변경 → 최신 일정 | 시간/상태 수정 범위 |
| `POST /api/me/interviews/{interviewId}/cancel` | 취소 의도 → 취소 상태 | 취소 후 재활성화 여부, 중복 취소 결과 |

기존 `Application.nextScheduleAt`과 독립 일정의 동기화 여부를 정하기 전에는 두 값을 자동 복제하지 않는다. 연결된 지원 건은 본인 소유여야 한다.

### B07 · 학습 목표 — EXT-05-04

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET/POST /api/me/learning-goals` | 목록·생성 → 목표, 연결 기술, 진행 상태 | 기술 연결 필수 여부, 진행 표현 |
| `GET/PATCH/DELETE /api/me/learning-goals/{goalId}` | 상세·수정·삭제 → 본인 목표 | 완료 취소·삭제/보존 정책 |
| `PATCH /api/me/learning-goals/{goalId}/completion` | 완료/취소 의도 → 최신 상태 | 완료와 보유 기술 자동 반영 여부 |

기존 `GET /api/me/skill-gap`의 읽기 전용 분석 결과와 사용자 학습 기록을 구분한다.

### B08 · 채용시장 확장 분석 — EXT-04 확정

세 GET API 모두 로그인 세션이 필요하고 저장된 공용 공고만 읽는다. 외부 출처나 AI를 호출하지 않는다. `source`는 `JobSource.code`의 정확한 값(대문자·숫자·밑줄, 1~100자), `desiredRole`은 공고 제목의 대소문자 무시 부분 일치(최대 200자)다. 날짜는 게시일 `YYYY-MM-DD`의 양 끝을 포함한다. 날짜 역전·형식 오류·출처 형식 오류·잘못된 기술 ID·간격은 `400 INVALID_INPUT`, 인증 없음은 `401`이다. 존재하지 않는 출처 코드나 기술 ID는 빈 집계로 응답한다.

| Method·URL | Query | 성공 응답 |
| --- | --- | --- |
| `GET /api/analytics/career-levels` | `dateFrom`, `dateTo`, `source`, `desiredRole` 모두 선택 | `MarketDistribution` · `200` |
| `GET /api/analytics/locations` | 동일 | `MarketDistribution` · `200` |
| `GET /api/analytics/skills/trends` | `dateFrom`, `dateTo`, 양의 `skillId` 필수; `interval=WEEK|MONTH`(기본 `MONTH`), `source`, `desiredRole` 선택. 날짜 범위는 최대 1830일 | `SkillTrend` · `200` |

분포의 모수는 해당 필터에 맞는 공용 `JobPosting` 수다. 분석 상태와 관계없이 출처·외부 ID로 고유하게 저장된 공고 한 행을 한 번 센다. 출처가 다른 동일 내용은 각각 한 건이다. 날짜 필터가 없으면 게시일 미상 공고도 포함하고, 날짜 필터가 있으면 제외한다. 경력 분류 키는 `ENTRY`(신입), `EXPERIENCED`(경력 또는 연차), `ANY`(무관·신입/경력), `OTHER`(그 외 명시값), `UNKNOWN`(null·공백·미상·미정·정보없음)이다. 지역 키는 `SEOUL`, `BUSAN`, `DAEGU`, `INCHEON`, `GWANGJU`, `DAEJEON`, `ULSAN`, `SEJONG`, `GYEONGGI`, `GANGWON`, `CHUNGBUK`, `CHUNGNAM`, `JEONBUK`, `JEONNAM`, `GYEONGBUK`, `GYEONGNAM`, `JEJU`의 17개 광역시도와 `NATIONWIDE_REMOTE`(전국·원격·재택), `OTHER`(식별 불가 또는 여러 광역시도), `UNKNOWN`(null·공백·미상·미정·정보없음)이다. 분포 항목은 건수가 있는 키만 키 오름차순으로 반환한다. 각 비율은 **전체 공고 수(미상 포함)** 대비 0~1을 소수 넷째 자리까지 반올림한다. 따라서 항목의 반올림된 비율 합계는 1과 조금 다를 수 있다.

`MarketDistribution` 예: `{ "jobCount": 5, "insufficientSample": true, "buckets": [{ "key": "ENTRY", "jobCount": 2, "ratio": 0.4 }, { "key": "UNKNOWN", "jobCount": 3, "ratio": 0.6 }] }`. 0건이면 `jobCount: 0`, `buckets: []`, `insufficientSample: true`다. 10건 미만은 표본 부족이며 전체 채용시장의 대표값으로 해석하지 않는다.

기술 추이는 **완료된 `AIAnalysis`가 있고 게시일이 있는 공고**만 각 기간의 `analyzedJobCount`로 센다. 기술별 `jobCount`는 그 중 해당 `JobSkill`을 가진 공고 수다. 필수·우대 모두 포함하며 `(job_posting_id, skill_id)` 한 관계를 한 번 센다. 기간 시작은 월요일(주) 또는 매월 1일(월)이고, 요청 날짜와 겹치는 기간을 첫 구간부터 마지막 구간까지 반환한다. 첫·끝 구간은 요청 날짜 범위 안의 공고만 센다. 기간에 공고가 없으면 표본 `0`, 기술 건수 `0`, 비율 `null`, `insufficientSample: true`다. 비율을 0으로 단정하지 않는다. 각 구간 비율의 분모는 해당 구간의 완료 분석 공고 수다.

`SkillTrend` 예: `{ "skillId": 7, "interval": "MONTH", "periods": [{ "periodStart": "2026-10-01", "analyzedJobCount": 3, "jobCount": 2, "ratio": 0.6667, "insufficientSample": true }, { "periodStart": "2026-11-01", "analyzedJobCount": 0, "jobCount": 0, "ratio": null, "insufficientSample": true }] }`.

**B11 공유 계약:** B11이 새 공식 출처를 공용 `JobSource`·`JobPosting`에 저장하면 B08의 출처 미지정 집계에 자동 포함한다. `source` 지정 시 그 코드만 센다. 별도 출처 허용 목록을 B08에 두지 않는다. 새 출처에 게시일·경력·지역이 비어 있으면 위 결측 규칙을 적용하고 임의 보완하지 않는다. 개인 직접 저장 공고는 공용 집계에 합치지 않는다. 기존 `GET /api/analytics/skills`의 완료 분석 모수·필터·응답은 변경하지 않는다.

### B09~B10 · 캐릭터·성장 — EXT-06

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET /api/me/character` | 없음 → 기본 외형, 장착 항목, 성장 상태 | 초기 상태, 레벨·EXP 규칙 |
| `GET /api/character/items` | 없음 → 항목 카탈로그와 사용 가능 조건 | 항목 분류·자산 ID·잠금 조건 |
| `PUT /api/me/character/equipment/{slot}` | 항목 ID → 최신 장착 상태 | 슬롯·중복 장착·해제 규칙 |
| `GET /api/me/character/activity` | 페이지 → EXP 변동 근거 | 지급 대상 활동·소급 여부 |
| `GET /api/me/character/quests` | 없음 → 목표·진행·보상 조건 | 퀘스트 주기·완료 판정 |
| `POST /api/me/character/quests/{questId}/claim` | 수령 의도 → 지급 결과/최신 상태 | 중복 수령·취소/삭제·동시 요청 |

활동 보상은 클라이언트가 임의 EXP를 보내는 API로 만들지 않는다. 서버가 검증한 활동 이벤트를 기준으로 한 번만 반영한다. B09에서 기본 상태·장착을, B10에서 성장·보상·퀘스트를 확정한다.

### B11 · 채용 출처 확장 — EXT-07

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| 기존 `GET /api/jobs`의 `source` 필터·상세 확장 | 저장된 새 출처 공고와 원문 링크·누락 필드 표현 | 출처 식별자·공고 고유키·필드 대응 |
| 수집 실행 API는 실행 주체 확정 후 결정 | 실행 결과/부분 실패/중복 건수 | 사용자가 실행하는지, 내부 작업인지 |

새 제공기관의 공식 접근 조건·호출 제한을 먼저 확인한다. 수집 실패는 기존 저장 공고·북마크·지원 조회에 영향을 주지 않는다. 외부 서비스의 공식 로고나 제휴 표식을 임의 노출하지 않는다.

### B12 · 이력서·자기소개서 AI 분석 — EXT-08-01~02

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `POST /api/me/resumes/{resumeId}/versions/{versionId}/analysis` | 명시적 요청 → 요청 ID/상태 | 분석 목적·동의·비용·재사용/재분석 |
| `GET /api/me/resumes/{resumeId}/versions/{versionId}/analysis` | 없음 → 상태·검증된 결과·분석 원본 버전 | 결과 스키마·보관·삭제 |
| 자기소개서 분석 경로는 저장 모델 확정 후 결정 | 원본 버전·상태·결과 | 독립 리소스인지 일회성 입력인지 |

기존 공고 AI 분석처럼 출력 검증·정규화 후 저장하고 `PENDING`/`COMPLETED`/`FAILED`를 구별한다. 원본 변경 후 오래된 결과를 최신으로 응답하지 않는다. AI 실패는 문서·CRM 기본 조회를 막지 않는다.

### B13 · 알림 설정 — EXT-01-04

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET/PUT /api/me/notification-preferences` | 종류별 설정 조회·전체 저장 → 실제 제공 종류/채널/선택값 | 알림 종류·전달 수단·발송 시점·실패 처리 |

설정 저장 API만 만들어 알림이 실제 발송되는 것처럼 표시하지 않는다. 발송이 범위라면 발송 이벤트·동의·재시도·중복 방지 계약을 이 단계에 추가한다.

### B14 · 의미 기반 비교·추천 — EXT-08-03

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET /api/me/recommendations/jobs` | 필터·페이지 → 추천 공고·근거·한계 | 평가 기준·재계산/캐시·후보 모수 |
| 문서/공고 비교 경로는 대상 확정 후 결정 | 비교 대상·근거·분석 상태 | 기존 규칙 기반 `matchRate`와 관계 |

기존 `GET /api/jobs/{jobId}/match`의 기술 일치도와 새 추천을 혼합하거나 합격 확률로 표현하지 않는다. 외부 AI 의존 시 장애 중에도 기존 비교·CRM 조회를 유지한다.

### B15 · 계정 삭제 — EXT-01-02~03

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET /api/auth/me/deletion-impact` | 없음 → 삭제/보존 대상과 복구 가능 여부 | 새 개인 리소스별 삭제·보존 범위 |
| `DELETE /api/auth/me` | 재인증/확인값 → 삭제 완료 및 세션 무효화 | 재인증 수단, 트랜잭션/비동기 여부, 외부 보관 |

영향 안내와 실제 처리 범위가 일치해야 한다. 성공 뒤 이전 세션으로 보호 API를 사용할 수 없어야 한다. 다른 사용자의 공용 기술·공고·출처 데이터에 영향이 없어야 한다.

## 3. Backend 완료 후 Frontend 인계 조건

B01~B15 각 단계마다 이 문서의 후보 표를 확정 계약으로 교체하고, 실제 Controller·DTO·서비스·테스트와 동기화한다. 전체 완료 시에는 모든 확정 API의 JSON 예시, 인증/CSRF, 페이지/정렬, 오류 코드, 빈 상태, 소유권, 비동기 상태를 한 번 더 대조한다. 그 뒤 [확장 UI 명세](extension-ui-spec.md)를 API 필드와 연결한다. 현재 이 문서는 **작업 범위와 설계 체크리스트**이며, 미정 필드가 있는 단계의 구현을 허가하는 완성 계약은 아니다.
