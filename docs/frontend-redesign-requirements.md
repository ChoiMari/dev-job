# DevJob 프론트 전면 개편 요구사항 명세

상태: 구현 전 요구사항 · 기준: 2026-10-09, B00~B15 Backend 완료

## 1. 목표와 계약

이 문서는 [디자인 개편안](frontend-redesign-proposal.md)의 시각 체계를 **현재 제공 중인 전체 Backend 기능**에 적용할 프론트 요구사항이다. 기존 [MVP 요구사항](requirements.md), [확장 요구사항](extension-requirements.md), [사용자 흐름](user-flow.md), [UI 명세](ui-spec.md), [확장 UI 명세](extension-ui-spec.md)를 대체하지 않고 화면 구현 범위를 구체화한다. 정확한 필드·상태 코드·인증·페이지 제한은 [MVP API 계약](api-spec.md), [확장 API 계약](extension-api-spec.md), 실제 Controller·DTO가 우선이다. 문서의 과거 단계 상태가 현재 코드와 다르면 구현 직전에 Controller·DTO를 다시 확인한다.

- 모든 일반 사용자 API는 기존 세션 인증을 사용한다. 변경 요청은 기존 클라이언트의 CSRF 처리와 같은 세션 토큰을 사용한다. `401`은 인증 상태를 다시 확인하고, `403`은 권한 또는 CSRF 오류로 표시한다.
- 화면에는 서버에 저장된 사실만 표시한다. 디자인 참고 이미지의 수치·문구·로고를 데이터처럼 채우지 않는다. `matchRate`, Skill Gap, 의미 기반 추천의 뜻을 서로 구분하고 합격 확률로 부르지 않는다.
- 비동기 분석은 `PENDING`, `COMPLETED`, `FAILED`를 분리한다. 재조회는 결과 확인이며 POST 재시도는 사용자의 명시적 행동으로만 실행한다. 외부 서비스 실패가 저장된 공고·CRM·문서 조회를 가리지 않는다.
- 목록/상세/변경 화면은 로딩, 0건, 오류, 재시도, 저장 중, 성공, 입력 오류를 구분한다. 실패 시 작성 중인 입력을 보존하고 서버 응답으로 확정된 상태만 표시한다.
- 기존 해시 라우트와 현재 기능을 유지하며 새 라우트는 아래 표를 따른다. 새 화면의 상세·등록 경로는 기존 `#/todos`, `#/projects`, `#/companies` 패턴을 따른다. URL은 프론트 내부 경로이며 Backend 계약을 바꾸지 않는다.
- 첫 접속의 `#/`은 인증 확인 결과에 따라 갈린다. `GET /api/auth/me`가 `401`이면 공개 홈 P00, 인증된 사용자이면 기존 대시보드 P02를 보여준다. 인증 확인 중에는 어느 화면도 잠깐 노출하지 않고, `401` 외의 조회 실패에는 재시도를 제공한다. 다른 보호 경로에 미인증으로 직접 접근하면 기존처럼 `#/login`으로 이동한다.

## 2. 공통 디자인 및 품질 요구사항

| ID | 요구사항 | 완료 기준 |
| --- | --- | --- |
| FR-C01 | 색·타이포·간격·카드·버튼·입력·배지·상태의 공통 토큰을 `styles.css`에서 정리한다. 개편용 장식은 `assets/redesign`와 [자산 매핑](frontend-asset-map.md)을 따른다. | 기존 중복 `:root`의 최종 적용값을 확인하고 페이지별 임의 스타일 충돌이 없다. 이미지 로딩 실패에도 기능이 사용된다. |
| FR-C02 | 어두운 Sidebar와 밝은 콘텐츠 영역, 현재 위치, 제목, 계정 정보를 일관되게 표시한다. 실제 화면만 메뉴에 둔다. | 직접 URL 진입·새로고침·뒤로 가기에서 제목과 활성 메뉴가 맞는다. 모바일 메뉴에서 모든 기능에 접근한다. |
| FR-C03 | 데스크톱 1440×1000, 태블릿 768×1024, 모바일 390×844와 320×812에서 읽기·입력·주요 행동을 제공한다. | 가로 넘침, 잘린 대화상자, 마지막 버튼 가림이 없다. 폭이 필요한 표/보드는 의미 있는 세로 목록으로 바뀐다. |
| FR-C04 | 버튼·입력·메뉴의 최소 44px 조작 영역, 키보드 포커스, 본문 바로가기, 명시적 라벨, 색 외의 상태 표시, 모션 감소 설정을 유지한다. | 키보드만으로 주요 흐름을 끝낼 수 있고 차트 수치를 텍스트로 읽을 수 있다. |
| FR-C05 | 공통 API 오류 처리와 상태 컴포넌트를 화면별 의미에 맞춰 쓴다. | 400/401/403/404/409/503과 네트워크 실패가 빈 데이터로 오인되지 않고 재시도·복구 행동이 있다. |
| FR-C06 | 삭제·계정 제거·AI 외부 전송은 대상과 영향을 먼저 알리고 명시적으로 실행한다. | 중복 제출이 막히고 취소 시 데이터가 바뀌지 않는다. 동의 본문은 요청마다 실제로 보낸다. |
| FR-C07 | 각 페이지 구현 시 기존 개편 에셋의 적합성을 먼저 확인하고, 필요한 새 픽셀 장면·캐릭터·투명 장식은 `imagegen` 스킬의 내장 `image_gen`으로 제작한다. | 채택한 새 이미지는 `frontend/src/assets/redesign/`에 저장해 실제 화면에서 사용하고, 자산 목록에 사용처·크기·접근성 처리를 기록한다. |

## 3. 페이지별 요구사항

| 페이지 ID · 라우트 | 화면 구성과 사용자 행동 | API 연결 묶음 | 필수 확인 |
| --- | --- | --- | --- |
| FR-P00 비로그인 `#/` | 첫 방문 공개 홈. DevJob의 목적과 실제 제공 기능인 공고 탐색·지원 기록·역량 관리의 짧은 소개, 로그인·회원가입 CTA. 장식은 개편안의 색·브랜드·일러스트를 따르되 사용자별 수치·가짜 공고·임의 추천은 표시하지 않는다. 로그인 사용자가 `#/`에 오면 P02로 분기한다. | A01의 `GET /api/auth/me`만 진입 시 사용; 공개 홈 자체의 데이터 API는 없음 | 첫 접속·새로고침·로그인/가입 이동, 세션 유무에 따른 분기, 인증 조회 실패 재시도, 모바일 CTA 노출 |
| FR-P01 `#/login`, `#/register`, `#/forgot-password` | 브랜드 워드마크·기존 픽셀 장면과 인증 폼. 로그인, 가입 전환, 세션 만료·비밀번호 변경 안내. 비밀번호 찾기는 API 없이 비활성 전송 버튼과 준비 중 안내만 제공한다. | A01 (로그인·가입만) | 자격 오류와 세션 확인, 입력 보존, 모바일 폼 우선 배치. 비밀번호 찾기에서 요청이 전송되지 않음 |
| FR-P02 로그인 후 `#/` | 실제 KPI, 지원에서 나온 다음 행동, 개인 미완료 할 일, 규칙 기반 추천, Skill Gap 미리보기. 각 출처를 제목으로 구분한다. | A02, A10 | 0건·분석 불가·대시보드 부분 오류, 링크 목적지 |
| FR-P03 `#/jobs`, `#/jobs/{jobId}` | 검색·필터·정렬·페이지, 출처·마감·전형 정보, 외부 원문, 북마크, 공용 AI 분석, 기술 일치도, 지원 기록. 사용자 ALIO 수집 버튼은 현재 화면에 없다. | A04, A05, A06; A07은 운영용 미연결 | 북마크 없는 분석 POST 금지, `409` 분석 미완료, 외부 지원과 앱 내 기록 구분 |
| FR-P04 `#/bookmarks`, `#/bookmarks/{manualId}` | 공용 북마크와 직접 등록 공고의 통합 목록, 직접 등록·수정·삭제, 개인 본문 분석, 지원 연결. | A06, A08 | `COLLECTED`/`MANUAL` 필드 차이, 분석 입력 변경 시 오래된 결과 제거 |
| FR-P05 `#/applications`, `#/applications/{id}` | 8개 상태의 필터/목록과 상세·상태 변경·이력·메모·다음 일정. 별도 면접 일정과 혼동하지 않는다. | A09 | 허용 전이·409, 타인 기록 403, 시각 오프셋과 상태 이력 |
| FR-P06 `#/profile` | 기본 프로필과 기술 검색·추가·삭제, 숙련도 1~5의 의미 있는 라벨과 경험 개월 입력. | A03 | 프로필 404는 미설정, 기술 `null`은 미입력, 저장 후 재조회 |
| FR-P07 `#/projects`, `#/projects/new`, `#/projects/{id}` | 목록·상세·등록·수정·삭제와 기술 연결. | A03 | 타인 소유 오류, 기술 검색, 긴 본문/기간 |
| FR-P08 `#/todos`, `#/todos/new`, `#/todos/{id}` | 개인 할 일 목록·필터·등록·수정·완료 취소·삭제. 대시보드 개인 할 일과 연결한다. | A11 | 기한의 오프셋/IANA 시간대, 중복 완료, 삭제 확인 |
| FR-P09 `#/companies`, `#/companies/new`, `#/companies/{id}` | 사용자 관심 기업 CRUD. 공용 공고 회사와 자동 연결·병합하지 않는다. | A12 | 동명 별개 기업, URL 중복 409, 공고 데이터 비변경 |
| FR-P10 `#/skill-gap` | 분석 표본과 부족 기술·우선순위, 공고별 기술 일치도와 다른 의미를 설명한다. 학습 목표 진입은 별도 행동이다. | A10 | 분석 불가·작은 표본·값 없음 |
| FR-P11 `#/analytics/skills` | 기술 수요, 경력 분포, 지역 분포, 기술 추이. 적용 필터·모수·미상값과 표/텍스트를 함께 제시한다. | A10 | 기간 역전, 집계별 다른 모수, 차트/표 일치 |
| FR-P12 `#/character` | 현재 외형·장착·카탈로그, 레벨/EXP, 활동 내역, 퀘스트·보상 수령. 서버의 `available`과 장착 응답을 따른다. | A13 | 잠금 409, 전체 의상 슬롯 제약, 중복 수령, 새로고침 복원 |
| FR-P13 `#/resumes`, `#/resumes/{id}` | 이력서 목록·제목 변경·불변 버전 추가/열람·삭제, 선택한 버전의 AI 분석/동의/결과 삭제. | A14, A16 | 원문은 선택 버전 상세에서만, `stale`·PENDING/FAILED, 삭제 영향 |
| FR-P14 `#/cover-letters`, `#/cover-letters/{id}` | 자기소개서의 같은 버전·분석 흐름. 이력서와 문서 종류를 명시한다. | A15, A16 | 다른 문서 버전 혼동 방지, 원문/결과 노출 범위 |
| FR-P15 `#/interviews`, `#/interviews/{id}` | 독립 면접 일정 목록·등록·수정·취소·재활성화와 선택적 지원 연결. 지원 상세에서 해당 일정으로 이동한다. | A17, A09 | `nextScheduleAt` 자동 동기화로 오인 금지, 시간대·취소 상태 |
| FR-P16 `#/learning-goals`, `#/learning-goals/{id}` | 학습 목표 목록·등록·수정·진행률·완료/취소·삭제. Skill Gap과 연결하되 별도 저장 데이터로 표시한다. | A18, A03 | 100% 완료 조건, 기술 경험 자동 변경으로 오인 금지 |
| FR-P17 `#/notifications` | 앱 내 면접/할 일 알림 목록·읽음 처리. Header 진입은 실제 목록과 연결될 때만 표시한다. | A19 | 설정 거부 항목·읽음 상태, 0건·페이지, 이메일/푸시처럼 표현 금지 |
| FR-P18 `#/recommendations` 및 `#/recommendations/{id}` | 이력서/자기소개서 버전과 공용/개인 공고 최대 20개를 선택해 명시적 동의 후 의미 기반 비교 요청; 근거·한계·제외 사유·오래됨 표시. | A20, A14, A15, A04, A08 | `matchRate`나 합격 확률 표시 금지, 후보 종류/ID, 완료/실패/제외/입력 부족 분리 |
| FR-P19 `#/settings` | 계정 이메일·로그아웃, 비밀번호 변경, 알림 종류별 수신 설정, 계정 삭제 영향 조회/재인증/확인. | A01, A19, A21 | 비밀번호 변경·삭제 204 뒤 세션 종료, 오류 시 세션 유지 |
| FR-P20 `#/admin/alio` | 허용 계정만 수동 ALIO 전체 배치를 실행·상태 조회하는 운영 화면. 일반 사용자 메뉴에 노출하지 않는다. | A22 | `403`일 때 제어 숨김, `RUNNING`·부분 실패·503, 자동 실행 없음 |

### 3.1 페이지별 이미지 작업 기준

아래 ID는 [이미지 제작 가이드](image-generation-brief.md)와 [산출물 목록](redesign-image-manifest.md)의 기존 후보를 뜻한다. 각 페이지 구현 시 실제 배치에 맞는지 먼저 확인한다. 부족한 장면만 `imagegen` 스킬의 내장 `image_gen`으로 새로 만든다. 공개 홈의 `CUR-15`는 여성 개발자가 뒷모습으로 작업하는 `cur-15-developer-at-work.png`를 사용한다.

| 페이지 | 우선 검토할 기존 이미지 | 추가 이미지 판단 |
| --- | --- | --- |
| P00 공개 홈 | BRAND-01/02, CUR-11 | F02에서 전용 소개 장면 `CUR-15` 생성·배치 |
| P01 로그인·가입 | CUR-01, BRAND-02 | 모바일 잘림·폼 가독성에 문제가 있을 때만 장면 추가 |
| P02 대시보드 | CUR-02, CUR-03, CUR-11 | 새 카드에 장식이 필요할 때만 추가 |
| P03 공고 목록·상세 | CUR-04, EXT-IMG-07 | 출처별 중립 장식이 필요할 때만 추가; 회사 로고는 생성 금지 |
| P04 관심 공고 | CUR-05 | 직접 등록·수집 구분은 코드 배지로 처리 |
| P05 지원 관리 | CUR-06 | 실제 상태·합격 결과를 이미지로 표현하지 않음 |
| P06 프로필 | CUR-07, EXT-IMG-02 | 사용자 사진·숙련도 그림 생성 금지 |
| P07 프로젝트 | CUR-08 | 프로젝트별 가짜 로고·성과 그림 생성 금지 |
| P08 할 일 | EXT-IMG-03 | 빈 상태 장식의 적합성 확인 |
| P09 관심 기업 | EXT-IMG-05A | 기업 로고·특정 기업 정보 생성 금지 |
| P10 역량 분석 | CUR-09 | 계산 결과는 차트·텍스트로 구현 |
| P11 시장 분석 | CUR-09, EXT-IMG-04 | 분포·추이 데이터는 차트·표로 구현 |
| P12 캐릭터 | `assets/character/` 완성 이미지, CUR-13, EXT-IMG-06B | 서버 `assetId`와 자산 목록 대조; 새 변형은 동일 캐릭터 기준으로 생성 |
| P13 이력서 | EXT-IMG-05B, EXT-IMG-08 | 원문·개인정보가 없는 중립 장식만 사용 |
| P14 자기소개서 | EXT-IMG-08, EXT-IMG-05B | 이력서와 혼동되면 전용 장식 생성 |
| P15 면접 일정 | EXT-IMG-05C | 확정되지 않은 일정·결과를 그리지 않음 |
| P16 학습 목표 | EXT-IMG-05D | 완료·보유 기술 획득을 그림으로 단정하지 않음 |
| P17 앱 내 알림 | CUR-14, EXT-IMG-01 | 목록 맥락에 맞는 장식이 부족할 때만 생성 |
| P18 의미 기반 추천 | EXT-IMG-08, CUR-12 | 점수·합격 확률·AI 결과를 그림에 넣지 않음 |
| P19 설정 | CUR-14, EXT-IMG-01 | 보안·알림 성공 상태를 장식으로 암시하지 않음 |
| P20 관리자 ALIO | EXT-IMG-07 | 배치 성공·제공기관 보증을 암시하는 그림 금지 |

새 이미지가 필요한 페이지는 [이미지 제작 가이드](image-generation-brief.md)의 팔레트·픽셀 스타일·제외 조건과 [디자인 참고 이미지](assets/frontend-redesign-reference.png)를 확인한다. 용도 하나당 이미지 하나를 생성하고, 투명 장식은 실제 알파 채널을 요청한다. 기존 파일을 덮어쓰지 않고 `frontend/src/assets/redesign/`에 고유 이름으로 저장해 화면에 연결한다. 제목·버튼·입력·상태 배지·차트·숫자는 코드와 실제 API 데이터로 렌더링한다. 배치 크기·모바일 잘림·대비·대체 텍스트·이미지 로딩 실패를 확인하고 [산출물 목록](redesign-image-manifest.md)에 최종 파일과 사용 화면을 기록한다.

`#/states`는 개발 확인용 경로로 유지하되 제품 메뉴에는 넣지 않는다. 신규 페이지의 세부 레이아웃은 [개편안](frontend-redesign-proposal.md)의 색·밀도·반응형 원칙을 따른다.

## 4. Backend API 전수 화면 매핑

표의 `/{id}` 등은 실제 API 표기의 리소스 ID를 축약한 것이다. 동일 경로의 여러 메서드는 **각각** 표기했다. 주 화면 외 재사용 진입점은 3절에서 정한다. A22는 운영자 전용이므로 일반 사용자 화면에서 호출하지 않는다.

| 묶음 | Backend Method·경로 전체 | 주 화면 / 연결 목적 |
| --- | --- | --- |
| A01 인증 | `GET /api/auth/csrf`; `POST /api/auth/register`; `POST /api/auth/login`; `POST /api/auth/logout`; `GET /api/auth/me`; `PATCH /api/auth/password` | P00의 최초 세션 분기, P01, P19, 공통 Layout / 인증·세션·보안 |
| A02 대시보드 | `GET /api/dashboard` | P02 / 실제 집계·지원 행동·개인 할 일·기본 추천 |
| A03 프로필·기술·프로젝트 | `GET /api/me/profile`; `PUT /api/me/profile`; `GET /api/skills`; `GET /api/me/skills`; `POST /api/me/skills`; `PATCH /api/me/skills/{skillId}/experience`; `DELETE /api/me/skills/{skillId}`; `GET /api/me/projects`; `POST /api/me/projects`; `GET /api/me/projects/{projectId}`; `PUT /api/me/projects/{projectId}`; `DELETE /api/me/projects/{projectId}` | P06, P07, P16 / 프로필·기술 선택·프로젝트 |
| A04 공고 탐색 | `GET /api/jobs`; `GET /api/jobs/{jobId}` | P03, P18 / 저장된 공고 조회·후보 선택 |
| A05 공고 AI·일치도 | `POST /api/jobs/{jobId}/analysis`; `GET /api/jobs/{jobId}/analysis`; `GET /api/jobs/{jobId}/match` | P03 / 공용 공고 분석·기술 일치도 |
| A06 공용 관심 공고 | `GET /api/bookmarks`; `POST /api/bookmarks`; `DELETE /api/bookmarks/{jobId}` | P03, P04 / 북마크. GET은 현재 P04의 A08 통합 목록으로 대체돼 UI 미호출 |
| A07 사용자 ALIO 수집 | `POST /api/jobs/collections/alio` | 현재 UI 미연결. Controller가 내부 수집용으로 표시하며 P03에 사용자 버튼이 없다. 관리자 전체 배치 A22와 범위가 다름 |
| A08 개인 저장 공고 | `GET /api/me/saved-jobs`; `POST /api/me/saved-jobs`; `GET /api/me/saved-jobs/{id}`; `PUT /api/me/saved-jobs/{id}`; `DELETE /api/me/saved-jobs/{id}`; `POST /api/me/saved-jobs/{id}/analysis`; `GET /api/me/saved-jobs/{id}/analysis` | P04, P18 / 통합 목록·직접 등록 공고·개인 분석 |
| A09 지원 | `GET /api/applications`; `POST /api/applications`; `GET /api/applications/{applicationId}`; `PATCH /api/applications/{applicationId}`; `PATCH /api/applications/{applicationId}/status`; `GET /api/applications/{applicationId}/history` | P05, P03, P04, P15 / 지원 기록·상태·이력 |
| A10 시장·역량 | `GET /api/analytics/skills`; `GET /api/analytics/career-levels`; `GET /api/analytics/locations`; `GET /api/analytics/skills/trends`; `GET /api/me/skill-gap` | P10, P11, P02 / 통계와 개인 부족 기술 |
| A11 개인 할 일 | `GET /api/me/todos`; `POST /api/me/todos`; `GET /api/me/todos/{todoId}`; `PATCH /api/me/todos/{todoId}`; `PATCH /api/me/todos/{todoId}/completion`; `DELETE /api/me/todos/{todoId}` | P08, P02 / 개인 할 일 |
| A12 관심 기업 | `GET /api/me/companies`; `POST /api/me/companies`; `GET /api/me/companies/{companyId}`; `PATCH /api/me/companies/{companyId}`; `DELETE /api/me/companies/{companyId}` | P09 / 독립 기업 기록 |
| A13 캐릭터 | `GET /api/me/character`; `GET /api/character/items`; `PUT /api/me/character/equipment/{slot}`; `GET /api/me/character/activity`; `GET /api/me/character/quests`; `POST /api/me/character/quests/{questId}/claim` | P12 / 장착·성장·퀘스트 |
| A14 이력서 | `GET /api/me/resumes`; `POST /api/me/resumes`; `GET /api/me/resumes/{resumeId}`; `PATCH /api/me/resumes/{resumeId}`; `DELETE /api/me/resumes/{resumeId}`; `GET /api/me/resumes/{resumeId}/versions`; `POST /api/me/resumes/{resumeId}/versions`; `GET /api/me/resumes/{resumeId}/versions/{versionId}` | P13, P18 / 이력서와 불변 버전 |
| A15 자기소개서 | `GET /api/me/cover-letters`; `POST /api/me/cover-letters`; `GET /api/me/cover-letters/{coverLetterId}`; `PATCH /api/me/cover-letters/{coverLetterId}`; `DELETE /api/me/cover-letters/{coverLetterId}`; `GET /api/me/cover-letters/{coverLetterId}/versions`; `POST /api/me/cover-letters/{coverLetterId}/versions`; `GET /api/me/cover-letters/{coverLetterId}/versions/{versionId}` | P14, P18 / 자기소개서와 불변 버전 |
| A16 문서 분석 | `POST /api/me/resumes/{resumeId}/versions/{versionId}/analysis`; `GET /api/me/resumes/{resumeId}/versions/{versionId}/analysis`; `DELETE /api/me/resumes/{resumeId}/versions/{versionId}/analysis`; `POST /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis`; `GET /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis`; `DELETE /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis` | P13, P14 / 선택 버전 분석 |
| A17 면접 | `GET /api/me/interviews`; `POST /api/me/interviews`; `GET /api/me/interviews/{interviewId}`; `PATCH /api/me/interviews/{interviewId}`; `POST /api/me/interviews/{interviewId}/cancel`; `POST /api/me/interviews/{interviewId}/reactivate` | P15, P05 / 독립 일정 |
| A18 학습 목표 | `GET /api/me/learning-goals`; `POST /api/me/learning-goals`; `GET /api/me/learning-goals/{goalId}`; `PATCH /api/me/learning-goals/{goalId}`; `PATCH /api/me/learning-goals/{goalId}/completion`; `DELETE /api/me/learning-goals/{goalId}` | P16, P10 / 개인 학습 기록 |
| A19 알림 | `GET /api/me/notification-preferences`; `PUT /api/me/notification-preferences`; `GET /api/me/notifications`; `PATCH /api/me/notifications/{id}/read` | P19, P17 / 앱 내 수신 설정·목록 |
| A20 의미 기반 추천 | `POST /api/me/recommendations/jobs`; `GET /api/me/recommendations/jobs?requestId={id}`; `GET /api/me/recommendations/jobs/{id}` | P18 / 새 추천 요청·저장 결과. 두 GET은 같은 결과의 대체 경로 |
| A21 계정 삭제 | `GET /api/auth/me/deletion-impact`; `DELETE /api/auth/me` | P19 / 영향·확인·세션 종료 |
| A22 관리자 ALIO 배치 | `POST /api/admin/jobs/collections/alio`; `GET /api/admin/jobs/collections/alio` | P20 / 관리자 수동 실행·진행 조회 |

## 5. 완료 판정

1. A01~A22의 모든 메서드가 명시한 화면 또는 공통 인증 동작에서 연결되고, 조건부 관리자 API는 권한 있는 화면에서만 호출된다.
2. P00~P20의 해당 기본·로딩·빈·오류·저장·좁은 폭 상태가 검증된다. 조건부 기능은 서버 권한/응답에 맞춰 비활성 또는 안내한다.
3. 공개 홈→로그인/회원가입→대시보드와 기존 인증→공고 탐색→관심 등록→분석→지원 기록, 프로필/프로젝트→Skill Gap, 개인 할 일→대시보드 흐름이 유지된다. 확장 문서→분석→추천, 면접/알림, 학습, 캐릭터 보상, 계정 삭제 흐름을 추가 검증한다.
4. API/DB 계약 변경 없이 구현한다. 실제 코드와 명세의 불일치가 발견되면 관련 문서를 동기화하고 계약 변경이 필요한 경우 별도 판단한다.

단계·의존성과 병렬 범위는 [프론트 실행 계획](frontend-redesign-implementation-plan.md)을 따른다.
