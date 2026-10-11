# DevJob 확장 REST API 명세 준비본

상태: **B01~B03·B05·B06~B08 확정·구현, B04 및 다른 단계는 계약 초안** · 2026-10-09

## 1. 사용 방법과 계약 상태

이 문서는 [확장 요구사항](extension-requirements.md) EXT-01~08 **전체**를 Backend부터 순차 구현하기 위한 API 목록이다. 단계 순서는 [Backend 로드맵](extension-backend-roadmap.md)을 따른다. `확정`으로 표시되지 않은 경로는 **후보**이며 구현 완료 API로 간주하지 않는다. 각 단계 착수 전에 정책을 확정하고, 해당 표를 `확정` 상태의 필드·형식·오류·예시까지 갱신한 다음 코드를 작성한다. 정책이 결정되지 않은 필드는 추측해 DTO·DB에 추가하지 않는다.

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

후보 표의 `필수 응답`은 프론트 연결에 필요한 최소 정보이며, **아직 확정 DTO가 아니다**. 확정된 단계의 계약은 아래 별도 절을 따른다. 나머지 단계는 확정 전 API 문서와 ERD를 함께 갱신한다. 기존 GET을 확장할 경우 현재 응답 필드를 제거하지 않는다.

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

`GET /api/dashboard`는 기존 필드와 함께 별도 `personalTodos: [Todo]`를 반환한다. 삭제되지 않은 미완료 할 일 중 위 기한 순 상위 5건이다. `nextActions`는 계속 지원 기록에서 계산하며 두 목록을 합치거나 서로 변환하지 않는다. 대시보드 조회는 외부 API를 호출하지 않는다. B10에서 완료 전환만 EXP 지급에 사용하며 이 대시보드 계약은 바꾸지 않는다.

### B04 · 기업 관리 — EXT-05-01

| Method·URL | 요청·필수 응답 | 확정 단계 |
| --- | --- | --- |
| `GET/POST /api/me/companies` | 목록·생성 → 사용자별 기업 기록, 메모·상태 | 식별·중복 규칙, 공고 회사와 연결 기준 |
| `GET/PATCH/DELETE /api/me/companies/{companyId}` | 상세·수정·삭제 → 본인 기록 | 삭제와 연결 공고의 처리, 필드 제한 |

동명 기업을 이름만으로 합치지 않는다. 기존 공용 `Company`와 사용자 기록을 같은 리소스로 취급할지 여부는 ERD 확정 시 결정한다.

### B05 · 이력서 관리 — EXT-05-02 (확정)

모든 경로는 서버 세션 인증이 필요하다. `POST`·`PATCH`·`DELETE`는 CSRF 토큰이 필요하다. `{resumeId}`와 `{versionId}`는 양의 Long이다. 다른 사용자 소유의 활성 이력서는 `403`, 없거나 삭제된 이력서는 `404`다. 다른 이력서에 속한 버전 ID는 `404`다. 목록은 `page=0`, `size=20` 기본, `page≥0`, `1≤size≤100`, `page×size≤2147483647`이며 `updatedAt DESC, id DESC` 순서다. 범위 밖 페이지는 빈 `items`와 실제 총수를 반환한다.

| Method·URL | 요청 | 성공 응답 |
| --- | --- | --- |
| `GET /api/me/resumes` | `page`, `size` 선택 | `{items: Resume[], page, size, totalElements}` · `200`; 본문 제외 |
| `POST /api/me/resumes` | `{ "title": "백엔드 이력서", "content": "원문 텍스트" }` | `Resume` · `201`; 1번 버전 생성 |
| `GET /api/me/resumes/{resumeId}` | 없음 | `Resume` · `200`; 본문 제외 |
| `PATCH /api/me/resumes/{resumeId}` | `{ "title": "수정된 제목" }` | `Resume` · `200`; 본문 버전 불변 |
| `DELETE /api/me/resumes/{resumeId}` | 없음 | 본문 없음 · `204`; 즉시 비노출 |
| `GET /api/me/resumes/{resumeId}/versions` | 없음 | `ResumeVersion[]` · `200`; `versionNumber DESC`, 본문 제외 |
| `POST /api/me/resumes/{resumeId}/versions` | `{ "content": "새 원문" }` | 새 `ResumeVersion` 메타데이터 · `201`; 본문 제외 |
| `GET /api/me/resumes/{resumeId}/versions/{versionId}` | 없음 | `ResumeVersion`과 `content` · `200`; 본인만 원문 조회 |

`Resume`은 `{id, title, latestVersionId, latestVersionNumber, latestVersionCreatedAt, createdAt, updatedAt}`이다. `ResumeVersion` 메타데이터는 `{id, resumeId, versionNumber, createdAt}`이며 상세에만 `content`가 추가된다. 시각은 UTC 기준 ISO 8601 직렬화의 마이크로초 정밀도다. 버전의 ID·번호·생성 시각·본문은 변경되지 않는다. `POST versions`는 항상 번호를 하나 증가시키고 새 ID를 발급한다. B12는 `(resumeId, versionId)`와 해당 버전의 `createdAt`으로 원본을 식별하고, 삭제된 이력서는 분석하지 않는다. `Resume.updatedAt`은 제목 변경이나 버전 추가 시 바뀌므로 원문 식별자로 사용하지 않는다.

제목은 공백 제거 후 1~200자, 본문은 공백 제거 후 1~100,000자 및 UTF-8 최대 262,144바이트다. 줄바꿈·탭 외 제어 문자는 거절한다. 필수 필드 누락·`null`·잘못된 타입·빈 문자열·알 수 없는 필드·빈 PATCH는 `400 INVALID_INPUT`이다. 공통 `401`·`403`·`404` 오류를 사용하며 본문·암호문·키를 오류 메시지에 넣지 않는다. 파일 업로드/다운로드와 기존 버전 본문 PATCH/DELETE, 복구 API는 제공하지 않는다.

원문은 AES-256-GCM으로 버전별 난수 nonce와 `resumeId`·`versionNumber` AAD를 사용해 암호화한 뒤 PostgreSQL에 저장한다. Base64 인코딩된 32바이트 `RESUME_ENCRYPTION_KEY` 환경변수가 없거나 유효하지 않으면 원문 읽기·쓰기만 `503 SERVICE_UNAVAILABLE`이며 기존 CRM은 계속 사용 가능하다. 키를 잃거나 교체하면 기존 암호문을 읽을 수 없으므로 운영 중 키를 안전하게 보존해야 한다. 삭제는 `deletedAt`을 기록하고 즉시 전체 조회에서 제외한다. 매일 03:00 UTC 정리 작업이 삭제 30일 이상 지난 이력서와 모든 버전을 영구 삭제한다. 따라서 실제 DB 제거는 30일 시점 이후 다음 정리 실행 때 이뤄진다. 백업 보존 정책은 아직 미정이며 DB 정리만으로 백업에서의 삭제를 보증하지 않는다. 자기소개서의 저장 모델과 B12 분석 결과 처리 계약은 B12에서 결정한다.

### B06 · 면접 일정 — EXT-05-03 (확정)

모든 경로는 로그인 세션이 필요하며 POST·PATCH는 CSRF 토큰이 필요하다. 목록은 본인 일정만 시작 시각 오름차순·ID 내림차순으로 반환한다. 같은 시각의 활성 면접도 등록할 수 있다.

| Method·URL | 요청 | 성공 응답 | 주요 오류 |
| --- | --- | --- | --- |
| `GET /api/me/interviews?page=0&size=20` | `page` 0 이상, `size` 1~100 | `{items: Interview[], page, size, totalElements}` · `200` | 페이지 오류 `400` |
| `POST /api/me/interviews` | `{applicationId?: number|null, title: string, startsAt: string, timeZone: string, stage?: "FIRST"|"SECOND"|"FINAL"|"OTHER"|null, interviewMethod?: "IN_PERSON"|"ONLINE"|"PHONE"|null, memo?: string|null}` | `Interview` · `201` | 입력·시간대 오류 `400`, 연결 지원 없음 `404`, 타인 지원 `403` |
| `GET /api/me/interviews/{interviewId}` | 없음 | `Interview` · `200` | 없음 `404`, 타인 일정 `403` |
| `PATCH /api/me/interviews/{interviewId}` | 위 필드 중 하나 이상. 시간 변경 시 `startsAt`과 `timeZone`을 함께 제공. 선택 필드에 `null`을 보내면 값을 비움 | `Interview` · `200` | 입력 오류 `400`, 없음 `404`, 타인 일정·지원 `403` |
| `POST /api/me/interviews/{interviewId}/cancel` | 없음 | 취소된 `Interview` · `200` | 없음 `404`, 타인 일정 `403`, 완료 상태 `409` |
| `POST /api/me/interviews/{interviewId}/complete` | 없음 | 완료된 `Interview` · `200` | 없음 `404`, 타인 일정 `403`, 취소 상태 `409` |
| `POST /api/me/interviews/{interviewId}/reactivate` | 없음 | 활성 `Interview` · `200` | 없음 `404`, 타인 일정 `403` |

`Interview`: `{id, applicationId: number|null, title, startsAt, timeZone, stage: "FIRST"|"SECOND"|"FINAL"|"OTHER"|null, interviewMethod: "IN_PERSON"|"ONLINE"|"PHONE"|null, memo: string|null, status: "SCHEDULED"|"CANCELLED"|"COMPLETED", cancelledAt: string|null, completedAt: string|null, createdAt, updatedAt}`. `title`은 공백 제외 1~200자다. `memo`는 앞뒤 공백을 제거해 최대 500자로 저장하며 빈 값은 `null`이다. 기존 일정의 세 추가 필드는 `null`이다. `startsAt`은 오프셋을 포함한 ISO 8601 날짜·시각, `timeZone`은 IANA 시간대 ID(최대 100자)이며 요청 오프셋이 해당 시각의 시간대 오프셋과 같아야 한다. 응답은 입력 시간대의 오프셋으로 시작 시각을 표시한다. 완료·취소 시각은 각각 상태 전환 시 기록하며 동시에 존재할 수 없다. 완료·취소 중복 요청은 같은 상태를 `200`으로 반환한다. 완료와 취소 사이 직접 전환은 `409`이며 먼저 재활성화해야 한다. 재활성화는 두 시각을 비우고 예정 상태로 돌린다. 취소·완료 일정도 목록·상세에서 조회하고 변경할 수 있다. 지원 연결은 선택이며 연결된 지원은 본인 소유여야 한다. 면접 일정과 `Application.nextScheduleAt`은 서로 자동 동기화하지 않고, 지원 상태·이력도 변경하지 않는다.

POST·PATCH의 필드 검증 실패는 `400`과 `INVALID_INPUT`으로 응답하고, `message`에는 제목·날짜/시간·시간대·지원 이력·단계·방식·메모 중 거절된 항목의 안전한 안내 문구를 담는다. 목록 페이지 입력 오류 등 다른 `400`은 공통 오류 문구를 유지한다.

### B07 · 학습 목표 — EXT-05-04 (확정)

모든 경로는 세션 인증이 필요하며 POST·PATCH·DELETE는 CSRF 토큰이 필요하다. 경로 ID와 `skillId`는 양의 JSON 정수(Long 범위)다. 목록은 기본 `page=0`, `size=20`이며 `page≥0`, `1≤size≤100`, `page × size≤2147483647`을 허용한다. `completed=true|false` 필터는 선택이다. 활성 목표를 `updatedAt` 내림차순·ID 내림차순으로 정렬한다. 초과 페이지는 빈 `items`와 실제 `totalElements`를 반환한다.

| Method·URL | 요청 | 성공 |
| --- | --- | --- |
| `GET /api/me/learning-goals` | 선택 `completed`, `page`, `size` | `200` `{items:[LearningGoal],page,size,totalElements}` |
| `POST /api/me/learning-goals` | `{ "title":"Java 심화", "description":"동시성 학습", "skillId":1, "progressPercent":0 }` | `201` 생성된 `LearningGoal` |
| `GET /api/me/learning-goals/{goalId}` | 없음 | `200` `LearningGoal` |
| `PATCH /api/me/learning-goals/{goalId}` | `title`, `description`, `skillId`, `progressPercent` 중 한 개 이상 | `200` 변경된 `LearningGoal` |
| `PATCH /api/me/learning-goals/{goalId}/completion` | `{ "completed": true }` 또는 `false` | `200` 최신 `LearningGoal` |
| `DELETE /api/me/learning-goals/{goalId}` | 없음 | `204` 본문 없음 |

`LearningGoal`은 `{id,title,description,skill:{id,name}|null,progressPercent,completed,completedAt,createdAt,updatedAt}`이다. 제목은 Unicode 공백을 한 칸으로 축약하고 앞뒤 공백을 제거한 1~200자 필수 문자열이다. 설명은 trim 후 최대 2000자이며 생략·`null`·공백은 `null`로 저장한다. 텍스트의 제어문자는 허용하지 않는다. `skillId`는 공용 Skill의 ID 또는 `null`이며 보유한 UserSkill일 필요가 없다. 없는 Skill은 `404`다. 생성 진행률은 생략 시 0, 제공하면 0~100 정수여야 한다. 생성 시 `completed=false`, `completedAt=null`이다. PATCH에서 누락 필드는 유지하고 `skillId:null`은 연결 해제, `description:null`은 제거한다. 제목 `null`·공백, 진행률 `null`, 빈 객체, 알 수 없는 필드, 잘못된 JSON 타입은 `400`이다.

완료 요청은 진행률이 이미 100이어야 하며 그렇지 않으면 `409 CONFLICT`다. 완료 중 진행률을 100 미만으로 낮추려면 먼저 완료를 취소해야 한다. 완료 취소는 `completedAt=null`로 만들고 진행률 100은 유지한다. 같은 완료 상태 재요청은 `completedAt`·`updatedAt`을 유지한다. 삭제는 `deletedAt`을 저장해 일반 조회에서 숨기며 반복 삭제와 삭제된 목표의 조회·변경은 `404`다. 활성인 타인 목표의 상세·변경·삭제는 `403`이다.

같은 사용자의 활성 목표에서 `(skillId 또는 null, 정리된 title)` 조합은 유일하다. 중복 생성·수정과 동시 충돌은 `409`이며 삭제된 목표와 같은 조합은 다시 만들 수 있다. 서로 다른 기술 또는 제목은 별도 목표다. 보유 기술을 삭제해도 공용 Skill과 목표 연결은 유지한다. 목표는 읽기 전용 `GET /api/me/skill-gap`의 분석 결과와 별도 저장되며, Skill Gap 결과가 바뀌어도 유지된다. 목표 완료·취소·삭제는 UserSkill 숙련도·경험, 프로젝트 기술, 기존 Skill Gap 계산을 자동 변경하지 않는다. 오류 본문은 공통 `{code,message}`다.

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

**B11 공유 계약:** B11이 기존 ALIO 공식 출처의 공고를 공용 `JobSource`·`JobPosting`에 저장하면 B08의 출처 미지정 집계에 자동 포함한다. `source` 지정 시 그 코드만 센다. 별도 출처 허용 목록을 B08에 두지 않는다. 새로 저장한 공고에 게시일·경력·지역이 비어 있으면 위 결측 규칙을 적용하고 임의 보완하지 않는다. 개인 직접 저장 공고는 공용 집계에 합치지 않는다. 기존 `GET /api/analytics/skills`의 완료 분석 모수·필터·응답은 변경하지 않는다.

### B09~B10 · 캐릭터·성장 — EXT-06

| 후보 Method·URL | 요청·필수 응답 | 착수 전 결정 |
| --- | --- | --- |
| `GET /api/me/character` | 없음 → 기존 외형·장착 필드와 성장 상태 | B09 외형, B10 성장 |
| `GET /api/character/items` | 없음 → 항목 카탈로그와 사용자별 사용 가능 상태 | B09 카탈로그, B10 해금 |
| `PUT /api/me/character/equipment/{slot}` | 항목 ID → 최신 장착 상태 | B09 슬롯, B10 보상 의상 |
| `GET /api/me/character/activity` | 페이지 → EXP 변동 근거 | B10 |
| `GET /api/me/character/quests` | 없음 → 목표·진행·보상 조건 | B10 |
| `POST /api/me/character/quests/{questId}/claim` | 수령 의도 → 지급 결과 | B10 |

활동 보상은 클라이언트가 임의 EXP를 보내는 API로 만들지 않는다. 서버가 검증한 활동 이벤트를 기준으로 한 번만 반영한다. B09에서 기본 상태·장착을, B10에서 성장·보상·퀘스트를 확정한다.

#### B09 · 슬롯별 꾸미기 — EXT-06-01~02 확정

슬롯은 `OUTFIT`(기본 `BASE`, 사용 가능 `MINT`·`BUNNY`, 잠금 `PEACH`·`BEAR`·`HOMEBODY`·`INTERVIEW`·`RAINCOAT`·`ASTRONAUT`), `HAIR`(기본 `CLASSIC`, `BOB`, `PONY`), `GLASSES`(기본 `NONE`, `ROUND`, `SQUARE`)다. 잠금 의상 6개는 `FUTURE_REWARD`, 나머지는 `ALWAYS`다. B10 보상·해금 구현 전에는 이 항목의 장착을 `409`로 거부한다. `itemId: null`은 해당 슬롯 기본값으로 해제한다. 같은 항목의 반복 장착은 성공하며, 다른 슬롯 값은 유지한다. 미저장 계정의 기본 상태는 `BASE`·`CLASSIC`·`NONE`이다. 각 항목의 `thumbnailAssetId`는 선택 목록용이다. 기존 의상 세 항목의 `assetId`와 모든 항목의 `layerAssetIds`는 기존 B09 소비자를 위해 반환한다. 현재 화면은 응답의 `equipment` 세 값으로 완성 이미지 하나를 선택한다.

일반 의상의 완성 이미지는 원래 그림체의 투명 1024×1536 PNG 27개이며 `character-{outfit}-{hair}-{glasses}.png` 규칙으로 선택한다. 전체 의상 `BUNNY`와 보상 세트 5종은 각각 `character-{item}.png` 한 장이다. 전체 의상 착용 중에는 저장된 헤어·안경 값을 유지하되 표시하지 않고, 두 슬롯의 PUT을 `409`로 거부한다. 다른 의상으로 바꾸거나 기본 의상으로 해제하면 이전 헤어·안경이 다시 표시된다. 전체 의상의 `assetId`와 `layerAssetIds`는 `B09-COMPLETE-{ITEM}`이다. 원형 안경은 검정, 사각 뿔테는 레드이고 민트 후드의 목과 두 눈이 보이도록 조합마다 제작했다. 파일 대응은 [이미지 목록](redesign-image-manifest.md)을 따른다. 기존 EXT-IMG-06A·06C·06D와 분리 레이어 자산은 호환용으로 보존한다. EXT-IMG-06B는 성장 장면이므로 카탈로그에 포함하지 않는다.

| Method·URL | Request | 성공 응답 | 오류 |
| --- | --- | --- | --- |
| `GET /api/me/character` | 없음 | 기존 `baseAssetId`, `slot`, `equippedItemId`, `equippedAssetId`와 `equipment: { "OUTFIT": "BASE", "HAIR": "CLASSIC", "GLASSES": "NONE" }`, 표시 순서대로 정렬된 `layerAssetIds` · `200` | 인증 없음 `401` |
| `GET /api/character/items` | 없음 | `{ id, slot, name, thumbnailAssetId, assetId, layerAssetIds, available, availabilityCondition }[]` · `200` | 인증 없음 `401` |
| `PUT /api/me/character/equipment/{slot}` | `{ "itemId": "BOB" }`; 해제는 `{ "itemId": null }` | 전체 슬롯의 최신 상태 · `200` | 값·슬롯 불일치 `400`, 보상 잠금 항목·전체 의상 착용 중 헤어/안경 변경 `409`, 인증 없음 `401`, CSRF 실패 `403` |

카탈로그 순서는 의상 9개, 헤어 3개, 안경 3개다. 사용자별 장착 행 하나에 세 슬롯을 저장하고 변경 요청은 사용자 행 잠금으로 직렬화한다. 경로에 사용자 ID를 받지 않고 인증 주체의 상태만 조회·변경한다. 장착은 재로그인 후에도 유지된다. B10에서는 기존 외형 필드를 유지하고 `progress` 필드를 추가하며 카탈로그의 `available`은 해당 사용자의 보상 수령 기록을 반영한다. `availabilityCondition`은 해금 후에도 카탈로그의 고정 조건 `FUTURE_REWARD`를 유지한다.

#### B10 · 경험치·레벨·퀘스트·보상 — EXT-06-03~04 확정

| Method·URL | Request | 성공 응답 | 오류 |
| --- | --- | --- | --- |
| `GET /api/me/character` | 없음 | 기존 B09 필드와 `progress: {level,totalExp,levelExp,nextLevelExp}` · `200` | 인증 없음 `401` |
| `GET /api/character/items` | 없음 | 기존 순서·자산 필드 유지, 사용자별 `available` · `200` | 인증 없음 `401` |
| `GET /api/me/character/activity` | `page` 기본 0, `size` 기본 20·최대 100 | `{items:[{id,activityType,activityId,expAmount,earnedAt}],page,size,totalElements}` · `200` | 잘못된 페이지 `400`, 인증 없음 `401` |
| `GET /api/me/character/quests` | 없음 | `[{id,activityType,targetCount,progressCount,rewardItemId,completed,claimed,claimedAt}]` · `200` | 인증 없음 `401` |
| `POST /api/me/character/quests/{questId}/claim` | 본문 없음, 세션 CSRF 필요 | `{questId,itemId,claimedAt,progress}` · `200`; 재수령은 기존 `claimedAt`과 아이템을 반환 | 없는 퀘스트 `404`, 조건 미달 `409`, 인증 없음 `401`, CSRF 실패 `403` |
| 기존 `PUT /api/me/character/equipment/{slot}` | B09와 동일 | 수령한 잠금 의상도 장착 가능, 최신 `progress` 포함 · `200` | 미수령 의상 `409`, 다른 B09 오류 유지 |

서버가 소유권을 확인한 개인 Todo의 **미완료→완료 첫 전환**에서 `TODO_COMPLETED` 활동으로 10 EXP를 지급한다. 생성·수정·반복 완료·취소·재완료·삭제는 지급하지 않는다. `(user_id, activity_type, activity_id)` 고유 제약과 Todo 행 잠금으로 재시도·동시 완료의 중복 지급을 막는다. 누적 EXP는 활동 원장의 합계이며 수치는 클라이언트가 제출할 수 없다. 최초 레벨은 1, 누적 100·250·450·700… EXP 도달 시 레벨이 오른다. `levelExp`는 현재 레벨 안에서 획득한 EXP, `nextLevelExp`는 다음 레벨까지 해당 레벨에서 필요한 총 EXP(1레벨 100, 2레벨 150, 3레벨 200…)다. 활동은 최신 지급 시각·ID 내림차순 페이지로 반환한다.

퀘스트는 반복 주기가 없는 일회성이다. 최초 완료 기록 수 1·3·5·10·20·30건에 각각 `TODO_1`→`PEACH`, `TODO_3`→`BEAR`, `TODO_5`→`HOMEBODY`, `TODO_10`→`INTERVIEW`, `TODO_20`→`RAINCOAT`, `TODO_30`→`ASTRONAUT`가 달성된다. `progressCount`는 목표에서 상한 처리한다. 달성만으로 아이템이 지급되지는 않으며 명시적 claim 뒤 사용자별 카탈로그에서 `available: true`가 되고 장착할 수 있다. 사용자 행 잠금과 퀘스트·아이템별 사용자 고유 제약으로 동시 claim을 한 번만 저장한다. 재수령은 새 보상을 만들지 않는다.

완료 취소·Todo 삭제 후에도 이미 지급한 EXP·퀘스트 실적·수령 아이템은 유지된다. B10 migration 시점에 이미 완료된 Todo는 `reward_eligible=false`로 표시해 소급하지 않으며 이후 취소·재완료도 지급하지 않는다. 그때 미완료였던 Todo는 이후 최초 완료 시 지급 대상이다. 다른 CRM 활동은 이번 지급 대상이 아니며 기존 CRM 조회는 B10 활동 API나 외부 서비스 호출에 의존하지 않는다.

### B11 · 채용 출처 확장 — EXT-07

| Method·URL | 요청·응답 | 권한·동작 |
| --- | --- | --- |
| `POST /api/admin/jobs/collections/alio` | 본문 없음 → `AlioBatchStatus`, `202` | 세션·CSRF·`ALIO_BATCH_ADMIN_EMAILS` 허용 목록. 진행 중 배치는 `409`, 키 미설정 또는 실행기 거부는 `503` |
| `GET /api/admin/jobs/collections/alio` | `AlioBatchStatus`, `200` | 같은 관리자 권한. 실행 전 `IDLE` |
| 기존 `GET /api/jobs`·`GET /api/jobs/{id}` | 저장 공고와 `source: ALIO_RECRUITMENT`·원문 링크·누락 필드 | 기존 조회 계약 유지, 외부 API 호출 없음 |

`AlioBatchStatus`는 `runId`, `status`, `startedAt`, `updatedAt`, `finishedAt`, `processedPages`, `created`, `duplicates`, `rejected`, `failed`, `sourceError`를 반환한다. 상태는 `IDLE|RUNNING|COMPLETED|PARTIAL_FAILURE|SOURCE_FAILED|STORAGE_FAILED`다. 시작 후 백그라운드에서 `ncsCdLst=R600020`, `ongoingYn=Y`의 모든 페이지를 차례로 조회하고 각 페이지의 공고를 독립 저장한다. 제목의 IT 신호로 제외하지 않는다. 제공된 URL이 유효하지 않으면 공식 ALIO 공고 상세 화면의 ID 링크를 사용한다. 페이지당 20건이며 기존 수집 입력 범위에 맞춘 1000페이지 안전 상한에 도달하면 `PARTIAL_FAILURE`와 `PAGE_LIMIT`을 남긴다. 진행과 누적 건수는 DB에 저장하고 실패 전 저장된 페이지는 유지한다. 10분 이상 진행 기록이 갱신되지 않으면 다음 명시적 요청이 실행을 재접수할 수 있다. 자동 실행·자동 재시도는 없다. 기존 사용자용 최대 3페이지 `POST /api/jobs/collections/alio` 계약은 유지한다.

새 제공기관의 공식 접근 조건·호출 제한을 먼저 확인한다. 수집 실패는 기존 저장 공고·북마크·지원 조회에 영향을 주지 않는다. 외부 서비스의 공식 로고나 제휴 표식을 임의 노출하지 않는다.

### B12 · 이력서·자기소개서 AI 분석 — EXT-08-01~02 (Backend 확정)

자기소개서는 `/api/me/cover-letters`에서 B05 이력서와 동일한 메서드·페이지·본문 제한·오류 계약으로 관리한다. `GET/POST /api/me/cover-letters`, `GET/PATCH/DELETE /api/me/cover-letters/{coverLetterId}`, `GET/POST /api/me/cover-letters/{coverLetterId}/versions`, `GET /api/me/cover-letters/{coverLetterId}/versions/{versionId}`를 제공한다. 생성은 `{title, content}`, 제목 변경은 `{title}`, 새 버전은 `{content}`다. 응답은 B05의 `Resume`·`ResumeVersion`과 같은 필드를 쓰되 버전 메타데이터의 `resumeId` 대신 `coverLetterId`를 반환한다. 모든 변경에는 세션·CSRF가 필요하다. 원문은 같은 `RESUME_ENCRYPTION_KEY`로 AES-256-GCM 암호화하되 이력서와 구분된 AAD를 쓴다. 버전은 불변이며 삭제는 즉시 비노출, DB 원본·버전은 30일 이후 매일 03:00 UTC 정리된다.

| Method·URL | 요청 | 성공 응답 |
| --- | --- | --- |
| `POST /api/me/resumes/{resumeId}/versions/{versionId}/analysis` | `{ "consentToExternalAnalysis": true }` | 새 요청·진행 중 `DocumentAnalysis` · `202`, 완료 결과 재사용 `200` |
| `GET /api/me/resumes/{resumeId}/versions/{versionId}/analysis` | 없음 | `DocumentAnalysis` · `200` |
| `DELETE /api/me/resumes/{resumeId}/versions/{versionId}/analysis` | 없음 | `204` |
| `POST/GET/DELETE /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis` | 이력서 분석과 동일 | 동일 |

`DocumentAnalysis`는 `{id, status, source: {documentType: "RESUME"|"COVER_LETTER", documentId, versionId, versionNumber, createdAt}, stale, result, failureReason, consentedAt, analyzedAt, updatedAt}`이다. `result`는 완료 때만 `{skills: string[], strengths: string[], improvements: string[]}`이고 그 외에는 `null`이다. `failureReason`은 실패 때만 일반 문구, `analyzedAt`은 완료 때만 시각이며 나머지는 `null`이다. 기술은 최대 20개·각 100자, 강점과 개선 제안은 각각 최대 5개·각 200자다. 결과에 점수·합격 가능성은 없다. 출력은 구조·길이·제어문자·정형 개인정보를 검증하고 기술명을 정규화·중복 제거한 후 암호화해 저장한다. 내용의 사실성은 AI가 보장하지 않으며 사용자가 원문과 대조해야 한다.

POST는 정확한 동의 본문을 매번 요구하고 지정 버전만 비동기로 분석한다. 서버는 전송 전에 이름·주소 등 라벨 행, 이메일·휴대전화·주민등록번호 형식, URL을 제거하고 최대 12,000자를 기존 설정의 OpenAI 호환 API에 보낸다. 자유 형식 개인정보를 모두 감지할 수는 없으므로 사용자는 분석 전 원문에 민감정보를 넣지 않아야 한다. 외부 제공자의 보존·삭제 조건은 아직 확인되지 않았으며 DB 삭제가 제공자 측 삭제를 뜻하지 않는다. 새 유료 공급자나 자동 분석은 없다.

같은 버전의 `COMPLETED`는 재사용하고, 5분 미만 `PENDING`은 중복 실행 없이 같은 상태를 돌려준다. `FAILED` 또는 5분 이상 멈춘 `PENDING`만 다음 명시적 POST에서 재시도한다. 자동 재시도·완료 결과 강제 재분석은 없다. 분석 DELETE는 즉시 결과를 제거하며 재분석은 다시 동의한 POST로 시작한다. 제목 변경은 `stale`을 바꾸지 않고, 새 버전 추가 후 이전 버전 결과의 `stale`은 `true`다. 원본 식별은 이력서/자기소개서 ID·버전 ID·버전 생성 시각이다. 문서 삭제 시 모든 분석 행을 즉시 삭제하고, 삭제된 문서의 분석 경로는 `404`다. 본인 소유가 아니면 `403`, 버전이 해당 문서에 없거나 분석 행이 없으면 `404`, 동의·경로 입력 오류는 `400`, AI 키 부재는 새 실행 시 `503`이다. AI 실패·잘못된 출력은 `FAILED`로 저장하며 문서·CRM 조회에는 영향을 주지 않는다.

### B13 · 앱 내 알림 — EXT-01-04 확정

제공 종류는 `INTERVIEW_REMINDER`(면접 시작), `TODO_REMINDER`(개인 할 일 기한) 두 가지이며 전달 채널은 **앱 내 목록**뿐이다. 두 종류 모두 기본 수신한다. 아직 미래인 일정의 시각이 현재부터 24시간 이내가 되면 예약 작업(1분 간격)이 알림을 생성한다. 24시간 이내에 새로 만든 일정은 다음 예약 스캔에서 생성되며 지난 시각은 알리지 않는다. 면접 취소와 할 일 완료·삭제는 스캔 대상에서 제외한다. 일정 시각이 바뀌면 바뀐 시각은 새 이벤트다. 제목만 바뀌어도 같은 시각의 알림은 다시 만들지 않는다. 이미 생성된 알림은 읽음 여부와 함께 남으며 보관·삭제 API는 없다.

| Method·URL | 요청 | 성공 응답 | 오류 |
| --- | --- | --- | --- |
| `GET /api/me/notification-preferences` | 없음 | `{ "interviewReminder": true, "todoReminder": true }` · `200` | 미인증 `401` |
| `PUT /api/me/notification-preferences` | 두 필수 Boolean 필드를 모두 담은 위 형태; 미지·추가 필드 거절 | 저장된 두 값 · `200` | 잘못된 입력 `400`, 미인증 `401`, CSRF 실패 `403` |
| `GET /api/me/notifications?page=0&size=20` | 0 이상 page, 1~100 size | `{ "items": [{ "id": 1, "type": "TODO_REMINDER", "sourceId": 2, "scheduledAt": "2026-10-10T09:00:00Z", "subject": "지원서 검토", "createdAt": "2026-10-09T09:00:00Z", "readAt": null }], "page": 0, "size": 20, "totalElements": 1 }` · `200`; 생성 시각·ID 내림차순 | 잘못된 페이지 `400`, 미인증 `401` |
| `PATCH /api/me/notifications/{id}/read` | 본인 알림 ID, 본문 없음 | 읽음 시각을 최초 한 번만 기록; 반복 호출도 `204` | 잘못된 ID `400`, 미인증 `401`, 타인 또는 없는 ID `404`, CSRF 실패 `403` |

수신 거부 상태에서 새 알림을 생성하지 않는다. 다시 켠 시점에 아직 미래이고 24시간 이내인 일정은 다음 스캔의 대상이다. `(user_id, type, source_id, scheduled_at)` 유일 제약으로 반복 스캔과 동시 실행의 중복을 막는다. 알림 DB 작업은 원래 면접·할 일 업무 요청과 분리하고 각 대상마다 별도 트랜잭션으로 수행한다. 한 대상의 생성 실패는 기록 후 다음 스캔에서 재시도하며 다른 대상과 기존 CRM 요청에 영향을 주지 않는다. 이메일·카카오·푸시 발송은 제공하지 않는다.

### B14 · 의미 기반 비교·추천 — EXT-08-03

| Method·URL | 요청 | 응답·오류 |
| --- | --- | --- |
| `POST /api/me/recommendations/jobs` | `{ "resumeVersionId": 3, "coverLetterVersionId": null, "candidates": [{"kind":"COLLECTED","id":10},{"kind":"MANUAL","id":7}], "consentToExternalComparison": true }` | 신규·진행 중 `202`, 동일 완료 입력 재사용 `200`와 아래 `RecommendationPage`. 후보는 0~20개, 중복·미지 필드·동의 누락은 `400`, 없는/타인 문서·공고는 `404`, AI 또는 암호화 키 미설정은 비교 실행 시 `503`. 미인증 `401`, CSRF 실패 `403`. |
| `GET /api/me/recommendations/jobs?requestId={id}&page=0&size=20` | 저장 결과 ID와 페이지 | `RecommendationPage` · `200`; 다른 사용자/없는 결과 `404`, 잘못된 페이지·ID `400`, 미인증 `401` |
| `GET /api/me/recommendations/jobs/{id}` | 위 GET의 단일 경로 별칭, 같은 page/size | 같은 응답·오류 |

`RecommendationPage`는 `{ "id": 1, "status": "COMPLETED", "stale": false, "failureReason": null, "consentedAt": "...", "analyzedAt": "...", "policyVersion": "B14_V1", "modelName": "gpt-5.4-mini", "resumeVersionId": 3, "coverLetterVersionId": null, "candidateCount": 2, "items": [{ "kind": "COLLECTED", "id": 10, "title": "백엔드 개발자", "status": "COMPLETED", "reason": null, "rank": 1, "evidence": [{ "documentQuote": "Java 서버 운영", "jobQuote": "Java 서비스 개발", "explanation": "관련 경험" }], "limitations": ["경력 연수 확인 불가"] }], "page": 0, "size": 20, "totalElements": 2, "limitation": "..." }` 형태다. `status`는 요청 단위 `PENDING|COMPLETED|FAILED`, 항목별 `PENDING|COMPLETED|FAILED|INSUFFICIENT_INPUT|EXCLUDED`이다. 본문 없는 공고는 `INSUFFICIENT_INPUT`, 이미 지원한 공고는 `EXCLUDED/ALREADY_APPLIED`, 마감 공고는 `EXCLUDED/EXPIRED`이다. 후보 0건이면 완료 후 빈 `items`가 나온다. 실패 사유는 일반 문구만 반환하고 원문·AI 응답은 노출하지 않는다. GET은 외부 호출을 하지 않는다.

본인 이력서·자기소개서의 불변 버전 중 하나 이상과 공용 수집 공고 `COLLECTED` 또는 본인 개인 저장 공고 `MANUAL`를 비교한다. B12 문서 분석과 공고 기술 분석 완료는 필수가 아니다. 사용자가 지정한 공고만 평가하며 외부 URL을 읽지 않는다. 모델은 기술·경험의 관련성과 강점의 근거를 바탕으로 비교 가능 후보에 1부터 연속 순위를 부여한다. 서버는 모든 후보·순위·인용의 원문 포함 여부와 출력 구조를 검증하고, 결과를 AES-256-GCM으로 저장한다. 점수·`matchRate`·합격 확률은 새 응답에 없다. 문서 버전당 마스킹 후 12,000자, 공고 본문당 마스킹 후 4,000자까지 전송한다. AI 출력은 추측할 수 있으며 잘린 입력과 공고 원문 결측이 한계다.

동일 사용자·문서 버전·공고 집합·입력 내용의 완료 결과를 재사용한다. 실패 또는 5분 이상 멈춘 요청은 다음 명시적 동의 POST에서 재시도한다. 결과는 문서 새 버전, 공고 내용 갱신, 마감·지원 상태 변화에 `stale: true`가 된다. 문서나 개인 공고 삭제 시 결과를 즉시 삭제한다. 기존 `GET /api/jobs/{jobId}/match`의 규칙 기반 기술 일치도와 대시보드 기본 추천은 그대로 유지되며 새 순위와 섞지 않는다. AI 장애가 공고 비교·CRM 조회를 막지 않는다.

`RecommendationPage`는 원본 버전과 평가 조건을 추적하도록 `policyVersion: "B14_V1"`, `modelName: "gpt-5.4-mini"`, `resumeVersionId`, `coverLetterVersionId` 필드를 추가로 반환한다. 입력 해시는 모델·정책 버전까지 포함해 계산하며 서버의 중복 판단에만 사용한다.

마감일의 경과 여부는 `Asia/Seoul` 날짜를 기준으로 판단한다.

진행 중인 외부 요청은 문서·개인 공고 삭제 시 이미 전송된 내용을 회수할 수 없다. 삭제는 DB 결과를 즉시 제거하며 공급자 측 보존·삭제는 별도 확인이 필요하다.

### B15 · 계정 삭제 — EXT-01-02~03 (확정)

| Method·URL | 인증·요청 | 성공 | 오류 |
| --- | --- | --- | --- |
| `GET /api/auth/me/deletion-impact` | 로그인 세션, 본문 없음 | `200 DeletionImpact` | 미인증 `401 UNAUTHORIZED` |
| `DELETE /api/auth/me` | 로그인 세션과 같은 세션의 `X-CSRF-TOKEN`; `{ "currentPassword": "password123", "confirmation": "계정 삭제" }` | `204 No Content`, 본문 없음, 현재 세션 종료·쿠키 삭제 | 누락·형식·확인 문구 불일치 `400 INVALID_INPUT`; 미인증·현재 비밀번호 불일치 `401 UNAUTHORIZED`; CSRF 없음·불일치 `403 FORBIDDEN`; 처리 실패 `500 INTERNAL_SERVER_ERROR`(전체 롤백) |

`DeletionImpact`의 필드·배열 항목 발췌: `{ "deletedResources": [{ "code": "resume_version", "name": "이력서 암호화 버전", "count": 2 }], "preservedSharedResources": ["공용 채용공고·회사·출처·수집 실행 정보", "공용 공고 AI 분석·기술·전형·첨부 메타데이터", "공용 표준 기술·별칭"], "confirmationText": "계정 삭제", "recoverableInApp": false, "processing": "동기 처리·운영 DB 즉시 삭제", "externalDataNotice": "운영 DB의 개인 기록은 즉시 삭제되며 앱에서 복구할 수 없습니다. DB 백업과 이미 전송된 AI 제공자 사본은 이 요청으로 삭제를 보장하지 않으며 별도 보존 정책에 따릅니다." }`. 실제 `deletedResources`에는 아래 25개 코드가 모두 나오며 `count`는 조회 시점의 본인 행 수(숨김·소프트 삭제된 행 포함)다. 조회와 삭제 사이에 새 기록이 생기면 DELETE는 실행 시점의 전체 행을 삭제한다.

| 삭제 코드 | 처리 대상 |
| --- | --- |
| `users`, `profiles`, `user_skill` | 계정·비밀번호 해시, 프로필, 보유 기술의 숙련도·경험 |
| `project`, `project_skill`, `bookmark` | 프로젝트·기술 연결, 공용 공고 북마크 |
| `application`, `application_status_history`, `interview_schedule` | 공용·개인 공고 지원 기록과 상태 이력, 면접 일정 |
| `personal_saved_job`, `personal_saved_job_analysis`, `interested_company` | 숨긴 개인 공고와 분석 결과, 관심 기업 |
| `personal_todo`, `learning_goal` | 삭제 표시한 기록을 포함한 할 일·학습 목표 |
| `resume`, `resume_version`, `cover_letter`, `cover_letter_version` | 삭제 표시한 부모를 포함한 문서와 암호화된 모든 버전 |
| `document_analysis`, `semantic_recommendation` | 암호화된 문서 분석·의미 기반 추천 결과와 요청 메타데이터 |
| `notification`, `notification_preference` | 앱 내 알림과 수신 설정 |
| `character_equipment`, `character_activity`, `character_reward` | 장착·EXP 활동 원장·보상 소유권 |

현재 비밀번호는 BCrypt 해시와 비교하며 UTF-8 최대 72바이트다. 확인 문구는 공백을 포함한 `계정 삭제`와 정확히 일치해야 한다. 삭제는 사용자 행 잠금 뒤 FK 자식부터 부모까지 하나의 DB 트랜잭션으로 처리한다. 실패하면 기록과 세션을 유지한다. 성공 후 현재 세션은 무효화하고 다른 기존 세션은 다음 보호 API 요청에서 계정 부재로 `401`이 된다. 같은 사용자의 동시 삭제는 한 요청만 성공하고 후속 요청은 `401`이며, 삭제 뒤 기존 이메일·비밀번호로 로그인할 수 없다. 같은 이메일의 새 가입은 새 계정으로 허용한다.

사용자 소유 기록의 비식별 사본은 만들지 않는다. 공용 `JobPosting`·`Company`·`JobSource`·수집 실행 정보, 공용 공고 분석·기술·전형·첨부 메타데이터, `Skill`·`SkillAlias`, 다른 사용자의 개인 기록은 유지한다. 앱은 삭제된 기록을 복구하지 않는다. 이 계약은 운영 DB의 즉시 삭제만 보장한다. DB 백업과 이미 전송된 AI 제공자 사본은 별도 보존 정책에 따르며 이 요청에서 원격 삭제를 실행하지 않는다.

## 3. Backend 완료 후 Frontend 인계 조건

B01~B15 각 단계마다 이 문서의 후보 표를 확정 계약으로 교체하고, 실제 Controller·DTO·서비스·테스트와 동기화한다. 전체 완료 시에는 모든 확정 API의 JSON 예시, 인증/CSRF, 페이지/정렬, 오류 코드, 빈 상태, 소유권, 비동기 상태를 한 번 더 대조한다. 그 뒤 [확장 UI 명세](extension-ui-spec.md)를 API 필드와 연결한다. 현재 이 문서는 **작업 범위와 설계 체크리스트**이며, 미정 필드가 있는 단계의 구현을 허가하는 완성 계약은 아니다.
