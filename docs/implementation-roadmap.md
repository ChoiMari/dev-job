# DevJob MVP 구현 로드맵

## 사용 방법

2026-10-07 기준 main에는 **S01·S02·S02-V·S03·S04·S05·S06·S07·S08·S09·S10·S11·S12·S13·S14·S15·S16**가 통합되어 있다. S01은 Backend·PostgreSQL 기반, S02와 S02-V는 Frontend 공통 기반·픽셀 디자인, S03은 계정·인증, S04는 프로필, S05는 기술 목록·정규화, S07은 공고 저장·모의 수집, S08은 저장 공고 검색·상세, S09는 Work24 공채속보 목록 Adapter를 구현했다. 각 단계의 개별 검증 근거는 단계별 보고서에, 통합 검증 결과는 [구현 근거](portfolio-log.md)에 기록했다. 한 단계의 선행 작업을 마치면 그 단계만 구현·검증한다. 독립적인 단계는 동시에 진행할 수 있다.

각 단계에 적힌 관련 문서만 우선 확인한다. 공통 규칙은 [AGENTS.md](../AGENTS.md), 복잡한 작업의 실행계획 기준은 [.agent/PLANS.md](../.agent/PLANS.md)를 따른다. DB·API 계약은 [ERD](erd.md)와 [API 명세](api-spec.md)가 기준이다. 구현된 API 범위는 API 명세에 표시하고, 나머지는 **설계 예정**이다.

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
| S09 | Work24 공채속보 목록 연동 | S07 | GPT-6.1 Sol · high |
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
- 상태: 2026-10-06 구현·검증 완료. 기본·인증 화면과 네 가지 공통 상태, Desktop·Tablet·Mobile 배치를 확인했고 Frontend 빌드와 API·인증 테스트 19개가 통과했다. 상세 시각·접근성 검증은 [UI 명세](ui-spec.md)와 [구현 근거](portfolio-log.md)에 기록했다.

### 계정과 사용자 데이터

**S03 · 계정·인증**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: User 저장·이메일 중복 방지, 회원가입·로그인·로그아웃·현재 사용자 API, 보호된 경로와 인증 화면을 구현한다. 비밀번호 저장과 사용자별 접근을 검증한다.
- 완료: 인증·미인증·중복 가입 테스트, Backend Compile·Frontend Build, 가입→로그인→로그아웃 확인.
- 검증 결과: Backend `test` 18개·PostgreSQL `dbTest` 9개와 `build` 통과, Frontend `test` 19개·`build` 통과. 실제 브라우저에서 가입·로그인 실패·정상 로그인·새로고침·로그아웃·보호 경로 차단·대소문자 중복 가입을 확인했다. 실제 HTTP 테스트는 이전 세션 쿠키/CSRF 재사용 차단과 쿠키 보안 속성을 확인했다. 30분 실시간 만료 대기와 배포 HTTPS 통합은 미실행이며 S03 검증은 격리된 로컬 PostgreSQL·HTTP 환경에서 수행했다.

**S04 · 프로필**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 사용자별 Profile 조회·저장 API와 첫 설정·수정 화면을 연결한다. 이메일은 User에만 저장하고 소유권을 확인한다.
- 완료: 신규/기존 프로필·타인 접근 테스트, Build와 저장 후 재조회 확인.
- 상태: 2026-10-06 구현·검증 후 main에 통합했다. 격리 DB에서 최초 저장·재조회·수정·사용자 분리·이메일 중복·CSRF를 확인했으며 Frontend 빌드·테스트와 실제 브라우저 프로필 흐름이 통과했다. 통합본에서는 S05 기술 관리와 같은 프로필 경로에 표시한다.

**S05 · 기술 목록·정규화**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: Skill·SkillAlias·UserSkill, 표준 기술 검색·별칭 정규화·내 기술 추가/삭제 API와 프로필 기술 UI를 구현한다.
- 완료: 중복·별칭·소유권·없는 기술 테스트, Build와 화면 추가/삭제 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 main에 통합했다. 일반 Backend 테스트 49개, 격리 DB 테스트 15개(S05 6개 포함), Frontend 테스트 23개와 양쪽 build를 통과했다. S07 DB 테스트 8개는 전용 DB 이름 가드로 당시 실행에서 제외했다. 실제 브라우저 별칭 추가→새로고침 조회→삭제→빈 목록 재조회와 중복 오류를 확인했다. 통합 시 기술 migration을 V4로 조정했고 기존 S05 격리 DB의 V3 이력은 보존했다. [S05 보고](s05-implementation-report.md)에 당시 검증 근거가 있다.

**S06 · 프로젝트 관리**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: Project·ProjectSkill 관계와 내 프로젝트 CRUD API·화면을 구현한다. 프로젝트 기술은 사용자 기술 목록과 독립적으로 관리한다.
- 완료: CRUD·기술 관계·타인 접근 테스트, Build와 등록→수정→삭제 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 main에 통합했다. V5로 Project·ProjectSkill을 추가하고 보호된 프로젝트 목록·등록·상세·수정·삭제 화면을 연결했다. Backend build·일반 테스트 84개, 격리 PostgreSQL의 S06 7개·기존 인증 등 9개, 별도 DB의 S05 회귀 6개, Frontend build·테스트 33개가 통과했다. DB 이름이 다른 26개는 S06 DB 실행에서 제외했다. 실제 Edge 브라우저에서 등록→새로고침→수정→삭제, 기술 관계 독립성, 20+1 페이지·페이지 오류 재시도, Tablet·Mobile 화면을 검증했다. 기존 개발 DB·적용 이력은 변경하지 않았다. 검증 재현은 Backend·Frontend README, 설계·문제 해결 근거는 [구현 근거](portfolio-log.md)를 따른다.

### 채용공고

**S07 · 채용공고 Adapter·모의 수집**
- 문서: [architecture](architecture.md), [requirements](requirements.md), [ERD](erd.md), [user flow](user-flow.md).
- 구현: JobSourceAdapter 계약, Company·JobSource·JobPosting 저장, 외부 응답 정규화·중복 처리·실패 격리를 만든다. 모의 응답으로 검증하며 공개 수집 API는 추가하지 않는다.
- 완료: 중복 키·회사 연결·누락 필드·외부 실패 테스트와 Backend Compile.
- 상태: 2026-10-05 구현·검증 완료. 모의 Adapter 응답의 정규화, 반복·동시 수집 중복 방지, 회사 연결, 필수/선택 필드 누락, 외부 실패 후 저장 데이터 조회, 공고별 DB 오류 롤백을 테스트했다. 일회용 PostgreSQL 17에서 Flyway·JPA 매핑 검증과 Backend `build dbTest`를 통과했다. 실제 Work24 연동·공고 조회 API·공개 수집 API·AI는 포함하지 않는다.

**S08 · 공고 검색·상세**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 저장된 공고의 목록·검색·기본 필터·상세 API와 화면을 연결한다. AI 기술·적합도·지원 상태에 의존하는 필터와 표시는 S11에서 지원 상태, S12에서 AI 분석, S13에서 기술·일치도 필터와 정렬을 연결했다. 분석이 없어도 공고 원문은 볼 수 있어야 한다.
- 완료: 검색·페이지·기본 필터·없는 공고 테스트, Build와 목록→상세 흐름 확인.
- 작업 상태: 2026-10-06 별도 worktree에서 구현·검증 후 main에 통합했다. Backend `build`·일반 테스트 45개, 격리 PostgreSQL `devjob_s08_test`에서 S08 7개·기존 DB 회귀 9개, Frontend `build`·테스트 23개가 통과했다. 실제 쿠키 인증과 목록→상세→목록·빈 결과·404·재시도·모바일 화면을 검증했다. S07 전용 DB 테스트 8개는 DB 이름 조건으로 당시 실행에서 제외했다. 새 migration은 없다. 재현과 공유 파일은 [S08 검증·통합 기록](s08-validation.md)을 참고한다.

**S09 · Work24 공채속보 목록 연동**
- 문서: [architecture](architecture.md), [requirements](requirements.md), [ERD](erd.md).
- 구현: 공식 공채속보 목록 계약에 맞춰 Work24Adapter를 S07의 경계에 연결한다. 자격 정보는 환경에서 주입하고 실패 시 저장된 공고 조회를 유지한다. 일반 채용정보목록·상세와 공채속보 상세는 S09 범위에서 제외한다.
- 완료: 모의 응답 회귀 테스트, 가능한 범위의 실제 연동, 중복 수집·장애 격리 확인.
- 상태: 2026-10-06 사용자가 S09 범위를 공채속보 목록 연동으로 확정했으며 해당 범위는 구현·검증 완료다. 일반 채용정보목록·상세와 공채속보 상세는 완료 조건에 포함하지 않는다. 공식 필드를 S07 내부 경계에 연결하고 환경변수 인증·안전한 XML/HTTP 실패 처리를 추가했다. Backend build 일반 73건·격리 PostgreSQL dbTest 20건·실제 공채속보 목록 1회 smoke 1건을 통과했다. 실데이터 저장·중복/장애 검증은 미실행이며 해당 회귀는 모의 HTTP+격리 DB로 검증했다. 본문·지역·경력·날짜는 이번 매핑에서 null이며 활용 조건·호출 빈도 한도는 운영 전 추가 확인 사항이다. 공개/자동 수집·새 migration은 없다. [architecture S09](architecture.md#s09-공식-접근계약-조사-2026-10-06)를 따른다.

**사람인 보완 연동 · 후속 검토**
- 사용자 요청: 공채속보 목록의 데이터 범위를 사람인 공고로 보완한다. S09의 Work24 완료 상태와 별도 관리한다.
- 상태: 공식 신청·명세·이용 조건 조사 완료. API 승인 대기이며 사용자 요청으로 구현 보류다. 사람인 코드·fixture는 유지하지 않으며 실제 호출·검증은 미실행이다. 승인 후 재개 요청 시 진행한다.
- 확인: 지역·경력·고용형태·게시일·마감 표현은 제공하지만 본문 필드는 확인되지 않았다. 일 500회·응답 최대 110건, 현재 진행 공고 조회를 공식 안내에서 확인했다.
- 다음 조건: 승인된 용도와 접근 권한을 확인한 뒤 별도 구현·회귀·격리 DB 검증 범위를 확정한다. [공식 조사](architecture.md#사람인-보완-연동-공식-조사-2026-10-06).

### 기본 CRM

**S10 · 북마크**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 사용자·공고 북마크 목록·추가·삭제 API와 공고 화면의 저장/해제를 연결한다. 같은 공고의 중복 저장을 막는다.
- 완료: 중복·타인 데이터 분리 테스트, Build와 저장→목록→해제 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 main에 통합했다. V6 북마크 migration·세 API·사용자별 공고 상태·관심 목록/저장/해제를 연결했다. Backend build 일반 83건·격리 DB 실행 23건(S10 동시 중복/소유권 등 7건·S08 7건·인증/연결/User 9건), Frontend build·33건과 실제 Edge 저장→목록→해제·사용자 분리·오류/재시도·반응형 검증을 통과했다. DB 이름 가드가 다른 19건은 건너뛰었다. [S10 검증](s10-validation.md).

**S11 · 지원·상태 이력**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: Application 등록·조회·메모/일정 수정, 허용된 상태 전이, 모든 상태 변경의 이력 저장과 지원 관리 화면을 구현한다. 공고의 사용자별 지원 상태도 연결한다.
- 완료: 최초 이력·전이·중복·소유권 테스트, Build와 등록→상태 변경→이력 조회 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 main에 통합했다. 지원 API 6개, 사용자별 공고 지원 상태·필터, Kanban·상세·등록 화면과 V7 migration을 추가했다. Backend build 일반 85개·격리 PostgreSQL DB 25개(S11 9개, S08 7개 포함), Frontend build·테스트 34개와 실제 쿠키 세션 브라우저 흐름을 통과했다. 다른 단계 전용 DB 테스트 19개는 DB 이름 가드로 건너뛰었다. 자세한 동시성·원자성·반응형 검증과 미실행 범위는 [S11 보고](s11-validation.md)에 기록한다.

### AI와 분석

**S12 · AI 공고 분석**
- 문서: [architecture](architecture.md), [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [user flow](user-flow.md).
- 구현: 공고별 AIAnalysis 요청·상태·결과 API를 구현한다. LLM 출력 검증, 기술 정규화, 결과 저장·재사용, 실패·재시도를 처리한다. 제공자와 처리 방식은 착수 전에 확정한다.
- 완료: 유효/무효 출력·중복 요청·실패/재시도 테스트와 Build, 실패 시 공고 조회·CRM 유지 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 main에 통합했다. 교육프로그램의 OpenAI 호환 API(`https://copa.codyssey.kr`, 모델 `gpt-5.4-mini`, 차감 배수 0.5)를 사용한다. 키는 서버 `OPENAI_API_KEY` 환경변수로만 주입한다. 사용자가 상세에서 요청한 분석만 비동기로 실행하고 `202 PENDING`을 GET으로 확인한다. 유효한 미등록 기술은 표준 Skill·별칭을 생성하는 것으로 사용자와 확정했다. S13 비교·적합도는 포함하지 않는다. 모의 응답·DB 검증 근거와 실제 API 검증 상태는 [S12 보고](s12-validation.md)를 따른다.

**S13 · 공고별 역량 비교**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: UserSkill과 ProjectSkill을 합쳐 분석된 공고 기술과 비교한다. 일치·부족 기술, 규칙 기반 적합도, 데이터 부족 응답을 만들고 공고 화면에 표시한다. 목록의 기술·최소 적합도 필터와 적합도 정렬을 완성한다.
- 완료: 계산 경계·기술 중복·분석 미완료 테스트, Build와 비교 화면 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 2026-10-07 main에 통합했다. 비교 API·목록 필터/정렬·상세 비교 화면을 구현했다. 빌드와 테스트 근거는 [S13 보고](s13-validation.md)를 따른다.

**S14 · 시장 기술 수요**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 완료된 분석 공고에서 기술 수요를 집계하고 기간·직무 필터와 표본 수를 제공한다. 시장 분석 화면을 연결한다. 별도 통계 저장 테이블은 만들지 않는다.
- 완료: 집계·필터·빈 결과 테스트, Build와 수요 화면 확인.
- 상태: 2026-10-06 별도 worktree에서 구현·검증 후 2026-10-07 main에 통합했다. 완료 분석 공고의 게시 기간·제목 필터, 기술별 건수·비율·표본 수·페이지 API와 `#/analytics/skills` 화면을 연결했다. Backend build·일반 테스트, 격리 PostgreSQL S14 DB 테스트 2건, Frontend build·테스트 46건과 모바일 브라우저의 필터·페이지·빈 결과·오류 재시도를 확인했다. 일회용 PostgreSQL의 완료 분석 데이터를 실제 Backend·Frontend로 조회했고, 사용자가 제공한 키를 테스트 프로세스에 주입해 실제 AI 분석→정규화 기술 3개 저장→S14 집계 API→모바일 화면까지 통과했다.

**S15 · Skill Gap·학습 우선순위**
- 문서: [requirements](requirements.md), [ERD](erd.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 사용자·프로젝트 기술과 목표 직무의 완료 분석 공고를 비교한다. 부족 기술을 `100 × (필수 공고 수 + 0.5 × 우대 공고 수) ÷ 분석 완료 공고 수`로 정렬하고 역량 분석 화면에 상위 5개를 표시한다. 5건 미만은 순위를 보류하고 5~19건은 표본 부족을 알린다.
- 완료: 기술·공고 데이터 부족과 우선순위 계산 테스트, Build와 화면 확인.
- 상태: 2026-10-07 확정한 점수·표본 기준으로 구현했다. 사용자·프로젝트 기술 합집합과 완료 분석 공고의 필수/우대 건수 집계, 점수 정렬, `GET /api/me/skill-gap`, `#/skill-gap`의 상위 5개·표본 부족·빈/오류 상태를 연결했다. Backend build·일반 테스트와 격리 PostgreSQL `devjob_s15_test`의 S15 DB 테스트 3건, Frontend build·테스트 51건, 390px Edge Chromium의 화면 흐름을 확인했다. 브라우저는 모의 API 응답을 사용했다.

**S16 · 대시보드**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [API](api-spec.md), [UI](ui-spec.md).
- 구현: 지원·북마크·적합도·Skill Gap 데이터에서 현황, 다음 행동, 기본 추천 공고와 역량 미리보기를 조합한다. 별도 할 일 기능은 만들지 않는다.
- 완료: 집계·빈 데이터·사용자 분리 테스트, Build와 관련 화면 이동 확인.
- 선정 기준: 진행 중 지원의 일정 순 상위 5건을 다음 행동으로 표시한다. 추천은 완료 분석·기술 적합도 양수·미마감·미지원 공고 중 적합도 순 상위 3건이다. 역량 미리보기는 S15 순위를 재사용한다. 상세 계약은 [API](api-spec.md)를 따른다.
- 상태: 2026-10-07 API·첫 화면·빈/오류 상태를 구현했다. Backend 일반 테스트와 격리 PostgreSQL `devjob_s16_test`의 집계·사용자 분리·추천/인증 테스트, Frontend build·테스트 53건을 통과했다. 390px Edge Chromium에서 대시보드 빈/데이터/오류·재시도, 상세 이동 링크와 가로 넘침·JavaScript 오류를 확인했다(모의 API 응답).

### 통합

**S17 · MVP 통합·배포 검증**
- 문서: [requirements](requirements.md), [user flow](user-flow.md), [architecture](architecture.md), [API](api-spec.md), [development plan](development-plan.md).
- 구현: 가입→프로필/기술/프로젝트→공고→북마크/지원→AI→역량·시장 분석→대시보드 흐름을 점검한다. Work24·LLM 장애, Secret 관리, 문서·구현 계약과 개발 환경 재현성을 확인한다. 실제 배포 대상은 결정된 경우에만 검증한다.
- 완료: Backend/Frontend Build, 관련 자동 테스트·핵심 흐름·장애 회귀, 문서 정합성 점검.
- 검증 상태 (2026-10-07): 격리 PostgreSQL·실제 HTTP·390px 브라우저 흐름, Backend/Frontend build·테스트, 별도 Compose 기동을 확인했다. [S17 검증 보고](s17-validation.md)에 통과·미실행과 배포 전 결정 사항을 기록했다. 실제 배포는 사용자 검토·후속 지시까지 보류한다.

## 착수 전 확인이 필요한 결정

해당 단계의 계약에 영향을 줄 때 확정한다. 다른 독립 단계는 계속 진행할 수 있다.

| 결정 | 필요한 단계 |
| --- | --- |
| PostgreSQL 스키마 적용·변경 방식: Flyway SQL migration + JPA `validate`로 확정. S01에서는 도메인 migration을 만들지 않는다. | S01, 첫 Entity 작업 |
| React 프로젝트 언어: TypeScript로 확정 | S02 |
| 서버 세션 + HttpOnly 쿠키, CSRF 조회 API 추가, 서버 세션 무효화 로그아웃으로 확정. 회원가입 화면은 이메일·비밀번호·확인(화면 전용)이며 상세 계약은 api-spec 2절. | S03 완료 |
| 프로젝트 관리 화면 최소 구성 | S06 |
| Work24 공채속보 목록 접근·매핑은 검증 완료; 활용 조건·호출 빈도 한도는 운영 전 확인 | S09 완료 / 운영 전 |
| 사람인 개인 개발자 API 승인·활용 조건·필드 매핑 | 사람인 후속 연동 |
| 교육프로그램 OpenAI 호환 API·`gpt-5.4-mini`·서버 환경변수 키·차감 배수 0.5로 확정. 금액 요금은 교육프로그램 안내에 없어 임의 환산하지 않는다. 202/PENDING은 비동기 접수와 GET 조회로 확정. | S12 |
| Skill Gap 점수·표본 기준: 필수 1·우대 0.5, 5건 미만 보류·5~19건 표본 적음, 등급 미사용 | S15 확정 |
| 대시보드 추천·다음 행동 선정 기준 | S16 |
| 실제 배포 대상·운영 설정 범위 | S17 |

## 단계 완료 규칙과 제외 범위

- 각 단계는 관련 문서·기존 구현 확인 → Backend 구현·테스트 → 필요한 Frontend 연결·Build → 화면/계약 통합 확인 순으로 마친다. API·DB 계약 변경은 api-spec.md·erd.md와 동기화한다.
- 병렬 작업은 소유 파일과 공통 계약을 먼저 나눈다. 공통 파일 또는 계약을 함께 바꿔야 하면 한 작업에서 먼저 확정한다.
- 이력서·자기소개서 분석, 알림, 관리자 기능, 별도 할 일 관리, 확장형 캐릭터, 복잡한 추천, 추가 채용 출처는 기본적으로 **MVP 이후**다. 사용자가 요청한 사람인 보완 연동은 별도 승인·계약 확인 후 후속 작업으로 진행한다. 새 기술·라이브러리·외부 서비스를 이 로드맵만으로 추가하지 않는다.
