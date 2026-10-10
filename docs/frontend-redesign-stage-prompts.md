# 프론트 전면 개편 단계별 작업 프롬프트

상태: 실행용 프롬프트 · 기준: [요구사항 P00~P20](frontend-redesign-requirements.md), [실행 계획 F00~F10](frontend-redesign-implementation-plan.md)

각 코드 블록은 **독립적으로 복사해 새 작업에 전달**할 수 있다. 같은 브랜치에서 순차 실행하거나, 아래 병렬 구간은 서로 다른 작업 트리에서 실행한다. 작업 시작 시 `AGENTS.md`와 해당 문서·코드의 최신 상태를 다시 확인한다. 이 문서의 파일 소유권은 병렬 충돌을 줄이기 위한 계획이며 실제 변경이 생겼다면 먼저 조정한다. 커밋·푸시·`main` 병합은 각 실행 요청에서 별도로 지시한다.

## 실행 순서와 병렬 구간

| 구간 | 실행 가능 작업 | 시작 조건 | 통합 조건 |
| --- | --- | --- | --- |
| 기준선 | F00 단독 | B00~B15 Backend 완료 상태 | Controller·DTO/API 차이와 기존 테스트 기준선 확인 |
| 공통 기반 | F01 단독 | F00 결과 반영 | 인증 분기·공통 토큰·라우트 뼈대가 빌드됨 |
| 1차 병렬 | **F02, F03, F04, F05, F06 동시 가능** | F01 결과가 공통 기준 브랜치에 반영됨 | 각 담당의 페이지·API·전용 CSS/이미지 범위만 통합 |
| 2차 병렬 | **F07**은 F03+F06 뒤, **F08**은 F04 뒤 | 필요한 선행 코드와 타입이 같은 기준 브랜치에 반영됨 | F07과 F08은 서로 독립이며 F02·F05가 아직 진행 중이어도 시작 가능 |
| 최종 통합 | F09 단독 → F10 단독 | F02~F08 전체 결과 반영 | 공용 파일 통합 후 전체 검증 |

병렬 중 `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/styles.css`, `frontend/src/api/index.ts`, 공통 컴포넌트, `docs/redesign-image-manifest.md`는 F01/F09 통합 담당만 수정한다. 각 담당은 필요한 라우트·메뉴·공용 타입·자산 목록 변경을 완료 보고에 적는다. F04는 지원 상세 파일을, F08은 설정 파일을, F07은 공고·문서 원본 화면을 직접 수정하지 않는다. 별도 작업 트리의 결과를 F07/F08 선행 조건으로 사용할 때는 **해당 선행 변경이 실제로 통합됐는지** 확인한다.

## F00 — 계약·기준선

```text
DevJob 프론트 개편 F00만 수행해 줘. AGENTS.md, .agent/PLANS.md, docs/frontend-redesign-requirements.md, docs/frontend-redesign-implementation-plan.md와 관련 API 명세를 확인해. Backend Controller/DTO의 모든 공개 Method·Path를 요구사항 A01~A22와 대조하고, frontend/src/api·pages·tests에서 이미 연결된 기능과 미연결 기능을 구분해. docs/redesign-image-manifest.md와 실제 자산을 확인해 P00~P20별 재사용 가능 이미지와 부족한 위치를 정리해. 현재 Git 변경사항을 보존하고 프론트 pnpm build·pnpm test를 기준선으로 실행해 실제 결과를 기록해. 구현·새 라이브러리·API/DB 변경은 하지 마. 확인된 계약 불일치만 근거와 영향 범위로 보고하고 F01~F08이 공유해야 할 타입/라우트 경계를 제시해.
```

완료 신호: API 전수 대조, 기존 연결 현황, 이미지 재사용 목록, 빌드·테스트 결과와 차이가 기록됐다.

## F01 — 공통 프레임과 인증 분기

```text
F00 결과가 반영된 상태에서 DevJob 프론트 개편 F01만 구현해 줘. docs/frontend-redesign-requirements.md의 FR-C01~C07·P00~P02, docs/frontend-redesign-proposal.md, docs/frontend-redesign-implementation-plan.md F01을 기준으로 frontend/src/App.tsx, components/Layout.tsx, components/States.tsx, styles.css와 최소 pages/LandingPage.tsx 뼈대만 담당해. 비로그인 첫 #/에는 공개 홈, 로그인 후 #/에는 기존 대시보드를 보여 주고, 다른 보호 경로의 비로그인 직접 진입은 로그인으로 보낸다. GET /api/auth/me 확인 중 화면 깜빡임을 막고 401 외 오류에는 재시도를 제공해. Sidebar·Header·토큰·카드·상태·반응형을 정리하되 기존 기능을 바꾸지 말고 새 기능 메뉴는 구현 전까지 활성화하지 마. F02가 공개 홈 컴포넌트를 완성할 수 있게 분리해. 1440/768/390/320px, 키보드 포커스·44px·pnpm build·관련 인증 테스트를 확인하고 결과를 보고해. 새 라이브러리와 Backend 계약 변경, 커밋·푸시는 하지 마.
```

완료 신호: 세션별 첫 화면과 공통 스타일이 동작하고 F02~F06이 충돌 없이 각 화면을 작업할 수 있다.

## F02 — 공개 홈·인증·대시보드·설정

```text
F01이 반영된 상태에서 DevJob 프론트 개편 F02만 구현해 줘. 요구사항 P00·P01·P02·P19와 A01·A02·A19의 설정 API·A21, 디자인 개편안 5.0~5.2·5.7을 확인해. F01의 pages/LandingPage.tsx를 완성하고 AuthPage, pages/dashboard, SettingsPage 및 이 화면 전용 API·CSS·테스트만 수정해. 공개 홈의 실제 기능 소개와 로그인/가입 CTA, 가입 후 로그인 안내, 대시보드의 서버 KPI·지원 다음 행동·개인 Todo·기본 추천 구분을 구현해. 비밀번호 변경·알림 수신 설정·계정 삭제 영향 확인과 재인증을 각 계약대로 연결하고 204 뒤 인증 상태를 처리해. 공개 홈 전용 CUR-15는 docs/image-generation-brief.md를 읽고 imagegen 스킬의 내장 image_gen으로 생성해 frontend/src/assets/redesign/에 고유 이름으로 저장·적용해. 기존 장식도 실제 배치에 맞는지 검토하고 가짜 수치·텍스트를 이미지에 넣지 마. App.tsx·Layout.tsx·styles.css·api/index.ts·공용 자산 목록은 직접 수정하지 말고 통합 담당에게 필요한 변경을 보고해. 관련 테스트·pnpm build와 4개 폭의 CTA·이미지 잘림·오류 상태를 검증해. 커밋·푸시는 하지 마.
```

완료 신호: P00/P01/P02/P19의 기능과 시각 상태가 검증되고 CUR-15의 최종 파일·프롬프트·사용처가 보고됐다. App의 추가 배선이 필요하면 F09 요청으로 남긴다.

## F03 — 공고·관심 공고·지원 관리

```text
F01이 반영된 상태에서 DevJob 프론트 개편 F03만 구현해 줘. 요구사항 P03~P05와 API A04~A09, docs/api-spec.md의 공고·분석·북마크·개인 저장 공고·지원 계약을 확인해. pages/jobs, pages/applications, 관련 전용 API·컴포넌트·CSS·테스트만 담당해. 검색·출처·정렬·페이지, 공고 상세/원문, 북마크 후 공용 분석, 개인 등록 공고의 본문 분석, 지원 8개 상태·허용 전이·이력·메모·일정을 유지하며 개편 디자인으로 정리해. 수집 공고와 직접 등록 공고, 외부 원문 열기와 앱 내 지원 기록, 기술 일치도와 AI 분석 상태를 구분해. 기존 CUR-04~06·EXT-IMG-07을 먼저 배치 검토하고 부족한 장식만 imagegen 스킬로 생성·적용해. 새 이미지는 redesign 폴더에 저장하고 실제 공고·회사 로고·수치를 그리지 마. App·Layout·전역 CSS·api/index·공용 자산 목록은 수정하지 말고 F07에 전달할 후보 kind/id 타입과 F09에 필요한 라우트·메뉴 변경을 보고해. 관련 테스트·pnpm build와 4개 폭의 로딩/빈/오류/긴 제목을 확인해. 커밋·푸시는 하지 마.
```

완료 신호: A04~A09 행동과 실패 상태가 검증되고 F07이 공고 후보를 선택할 계약이 확정됐다.

## F04 — 프로필·프로젝트·할 일·기업·면접

```text
F01이 반영된 상태에서 DevJob 프론트 개편 F04만 구현해 줘. 요구사항 P06~P09·P15와 API A03·A11·A12·A17, docs/extension-api-spec.md B06을 확인해. ProfilePage, pages/projects·todos·companies, 새 pages/interviews와 각 전용 API·CSS·테스트만 담당해. 기술의 null 숙련도/경험, 프로젝트 기술 연결, Todo의 시간대·완료/취소, 관심 기업과 공용 회사의 분리, 독립 면접 일정의 취소/재활성화를 계약대로 연결해. 지원 nextScheduleAt과 면접 일정은 자동으로 같다고 표시하지 마. P06~P09·P15의 기존 CUR/EXT 이미지를 먼저 확인하고 새 이미지가 필요하면 imagegen 스킬로 생성·적용해. App·Layout·전역 CSS·api/index·공용 자산 목록과 pages/applications는 수정하지 말고 지원 상세에서 면접으로 이동하는 링크 요구를 F09에 전달해. 관련 테스트·pnpm build, 소유권/404/409·시간대·4개 폭을 검증해. 커밋·푸시는 하지 마.
```

완료 신호: A03/A11/A12/A17의 CRUD와 면접 상태가 검증되고 F08이 알림 출처를 연결할 수 있다.

## F05 — 역량·시장 분석·학습 목표

```text
F01이 반영된 상태에서 DevJob 프론트 개편 F05만 구현해 줘. 요구사항 P10·P11·P16와 API A10·A18, 확장 API 명세 B08·B07을 확인해. pages/analytics와 새 pages/learning-goals, 해당 전용 API·CSS·테스트만 담당해. 기술 수요·경력 분포·지역 분포·기술 추이의 서로 다른 표본·필터·미상값을 정확히 표시하고, 차트와 동등한 텍스트/표를 제공해. Skill Gap의 계산 불가와 개인 학습 목표를 구분하고 진행률 100 완료 조건을 지켜. CUR-09·EXT-IMG-04·05D를 먼저 검토한 뒤 부족한 장식만 imagegen 스킬로 생성·적용해. 실제 차트·숫자는 이미지로 만들지 마. App·Layout·전역 CSS·api/index·공용 자산 목록은 수정하지 말고 통합 변경을 F09에 전달해. 관련 테스트·pnpm build, 기간/표본/빈 결과·4개 폭을 검증해. 커밋·푸시는 하지 마.
```

완료 신호: A10/A18의 표시값과 필터·오류 상태가 검증되고 데이터 시각화의 텍스트 동등성이 확보됐다.

## F06 — 캐릭터·이력서·자기소개서·문서 분석

```text
F01이 반영된 상태에서 DevJob 프론트 개편 F06만 구현해 줘. 요구사항 P12~P14와 API A13~A16, docs/extension-api-spec.md B09·B10·B12 및 docs/redesign-image-manifest.md의 캐릭터 자산 ID를 확인해. CharacterPage와 새 pages/resumes·cover-letters, 해당 전용 API·CSS·테스트만 담당해. 서버 equipment/available/EXP/퀘스트·보상과 완성 PNG를 맞추고 잠금·전체 의상 슬롯 제약을 지켜. 이력서·자기소개서의 불변 버전·원문 조회, 명시적 동의 분석, PENDING/COMPLETED/FAILED/stale, 결과 삭제를 구현해. 기존 캐릭터 완성 이미지·CUR-13·EXT-IMG-05B/06B/08을 우선 사용하고 부족한 장식만 imagegen 스킬로 생성·적용해. 새 캐릭터 변형은 기준 시트·자산 ID·동일 비율을 유지해. App·Layout·전역 CSS·api/index·공용 자산 목록은 수정하지 말고 F07에 문서 버전 선택 타입과 F09에 라우트 변경을 전달해. 관련 테스트·pnpm build, 재조회/동의/오래됨/잠금·4개 폭을 검증해. 커밋·푸시는 하지 마.
```

완료 신호: A13~A16의 서버 상태와 자산 표시가 일치하고 F07이 문서 버전을 선택할 수 있다.

## F07 — 의미 기반 추천

```text
F03과 F06의 결과가 같은 기준 브랜치에 통합된 것을 확인한 뒤 DevJob 프론트 개편 F07만 구현해 줘. 요구사항 P18과 API A20, F03의 COLLECTED/MANUAL 후보 타입, F06의 이력서/자기소개서 불변 버전 타입, docs/extension-api-spec.md B14를 확인해. 새 pages/recommendations와 추천 전용 API·CSS·테스트만 수정해. 사용자가 지정한 최대 20개 공고와 하나 이상의 문서 버전, 외부 비교 동의를 정확히 전송하고 저장 결과 GET으로 PENDING/COMPLETED/FAILED, 제외·입력 부족, 근거·한계·stale를 표시해. 기존 matchRate·대시보드 추천과 섞거나 합격 확률로 표현하지 마. EXT-IMG-08·CUR-12를 먼저 검토하고 추가 장식만 imagegen 스킬로 생성·적용해. App·Layout·전역 CSS·api/index·공고/문서 원본 화면·공용 자산 목록은 수정하지 말고 진입점 요구를 F09에 전달해. 관련 테스트·pnpm build, 0/20/초과 후보·404/503·4개 폭을 검증해. 커밋·푸시는 하지 마.
```

완료 신호: A20의 요청·저장 결과와 기존 기술 일치도 분리가 검증됐다.

## F08 — 앱 내 알림·관리자 배치

```text
F04의 면접·할 일 연결 결과가 기준 브랜치에 통합된 것을 확인한 뒤 DevJob 프론트 개편 F08만 구현해 줘. 요구사항 P17·P20과 API A19의 알림 목록/읽음·A22 관리자 ALIO 배치, docs/extension-api-spec.md B11·B13을 확인해. 새 pages/notifications·pages/admin과 전용 API·CSS·테스트만 담당해. 앱 내 면접/할 일 알림의 페이지·읽음 상태·출처 링크를 표시하고 이메일/푸시처럼 표현하지 마. 관리자 화면은 GET의 403을 권한 없음으로 처리해 실행 제어를 숨기고, 명시적 POST·RUNNING/부분 실패/503을 정확히 보여줘. 현재 사용자용 ALIO 수집과 관리자 전체 배치를 혼동하지 마. EXT-IMG-01·07을 먼저 검토하고 부족한 장식만 imagegen 스킬로 생성·적용해. SettingsPage·App·Layout·전역 CSS·api/index·공용 자산 목록은 수정하지 말고 설정/알림 및 관리자 진입점 요구를 F09에 전달해. 관련 테스트·pnpm build·4개 폭을 확인해. 커밋·푸시는 하지 마.
```

완료 신호: A19 목록/읽음과 A22의 권한·진행·오류 상태가 검증됐다.

## F09 — 전체 화면·공용 파일 통합

```text
F02~F08 결과가 모두 현재 작업 트리에 반영된 뒤 DevJob 프론트 개편 F09만 수행해 줘. docs/frontend-redesign-implementation-plan.md, 요구사항 P00~P20/A01~A22와 각 단계 완료 보고를 확인해. 통합 담당으로서 App.tsx·Layout.tsx·styles.css·api/index.ts·공통 컴포넌트의 라우트/메뉴/토큰 충돌을 해결하고, 각 페이지의 직접 진입·새로고침·뒤로 가기·세션 만료를 연결해. F04의 지원→면접, F02의 설정→알림, F03/F06→F07 추천 진입점을 붙여. 이미지 생성 결과의 실제 사용 파일·사용처·표시 크기·접근성 처리를 docs/redesign-image-manifest.md에 합쳐. 변경된 UI/사용자 흐름/API 문서만 사실에 맞게 동기화하고 메서드별 UI 연결 누락을 전수 점검해. 관련 테스트·pnpm build와 핵심 브라우저 흐름을 실행해. 다른 기능을 리팩토링하거나 새 Backend 계약을 만들지 말고, 미연결·불일치·미실행 검증을 명시해. 커밋·푸시는 하지 마.
```

완료 신호: P00~P20 라우트와 A01~A22 UI 연결이 통합되고 공용 문서·자산 목록이 실제 코드와 일치한다.

## F10 — 최종 회귀·인계

```text
F09 통합이 완료된 상태에서 DevJob 프론트 개편 F10 최종 검증만 수행해 줘. docs/frontend-redesign-implementation-plan.md의 G1~G6과 요구사항 완료 판정을 체크리스트로 사용해. frontend에서 pnpm build·pnpm test와 관련 브라우저/Backend 연동 흐름을 가능한 범위에서 실행하고, 비로그인 공개 홈→인증→대시보드→공고/지원, 문서 분석→추천, 면접→알림, 학습, 캐릭터 보상, 계정 삭제를 확인해. 1440×1000·768×1024·390×844·320×812에서 주요 화면의 가로 넘침, CTA 가림, 이미지 크롭·실패 대체, 키보드 포커스·모션 감소·차트 텍스트를 확인해. 실패하면 해당 요청 범위의 결함을 고치고 필요한 회귀만 다시 실행해. 검증하지 못한 항목은 통과로 적지 말고 환경과 이유를 명시해. 최종 변경 파일·문서 동기화·남은 주의사항을 보고해. 승인 없는 커밋·푸시·배포는 하지 마.
```

완료 신호: G1~G6의 실제 결과와 미검증·잔여 결함이 구분된 인계 보고가 있다.
