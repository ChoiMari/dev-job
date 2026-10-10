# 프론트 개편 F00 계약·기준선 기록

기준: 2026-10-10. 구현 변경 없음. 작업 착수 시 `git status --short`는 비어 있었다.

## 1. Backend 공개 계약과 현재 프론트 연결

`backend/src/main/java`의 `*Controller.java`에 선언된 HTTP 매핑을 [A01~A22 표](frontend-redesign-requirements.md#4-backend-api-전수-화면-매핑), [MVP API](api-spec.md), [확장 API](extension-api-spec.md)와 대조했다. 업무 API는 108개이며 A01~A22에 Method·Path가 모두 있다. Spring 오류 처리용 `ApiErrorController`의 `/error`는 업무 API가 아니므로 제외했다. A20의 두 GET은 같은 결과를 조회하는 별도 공개 경로로 각각 세었다. 아래의 연결은 `frontend/src/api`의 호출 함수가 실제 `pages`/`components`에서 사용되는 경우이며, `frontend/tests/*.test.mjs`의 단위 테스트도 확인했다. 이 표는 브라우저 통합 검증 결과가 아니다.

| 묶음 | Controller 경로 수 | 현재 화면 연결 | 미연결 Method·Path / 비고 |
| --- | ---: | --- | --- |
| A01 인증 | 6 | 6/6 · P01, P19, App, 공통 CSRF | 없음. P00 공개 홈 분기는 아직 없음 |
| A02 대시보드 | 1 | 1/1 · P02 | 없음 |
| A03 프로필·기술·프로젝트 | 12 | 12/12 · P06, P07 | 없음 |
| A04 공고 탐색 | 2 | 2/2 · P03 | 없음 |
| A05 공고 분석·일치도 | 3 | 3/3 · P03 | 없음 |
| A06 공용 북마크 | 3 | 3/3 · P03, P04 | 없음 |
| A07 사용자 ALIO 수집 | 1 | 0/1 | `POST /api/jobs/collections/alio` |
| A08 개인 저장 공고 | 7 | 7/7 · P04 | 없음. 현재 P04는 `#/bookmarks` 안에서 처리하며 별도 상세 라우트는 없음 |
| A09 지원 | 6 | 6/6 · P03, P05 | 없음 |
| A10 시장·역량 | 5 | 2/5 · P10, P11 | `GET /api/analytics/career-levels`, `GET /api/analytics/locations`, `GET /api/analytics/skills/trends` |
| A11 개인 할 일 | 6 | 6/6 · P08 | 없음 |
| A12 관심 기업 | 5 | 5/5 · P09 | 없음 |
| A13 캐릭터 | 6 | 3/6 · P12 | `GET /api/me/character/activity`, `GET /api/me/character/quests`, `POST /api/me/character/quests/{questId}/claim` |
| A14 이력서 | 8 | 0/8 | `GET/POST /api/me/resumes`; `GET/PATCH/DELETE /api/me/resumes/{resumeId}`; `GET/POST /api/me/resumes/{resumeId}/versions`; `GET /api/me/resumes/{resumeId}/versions/{versionId}` |
| A15 자기소개서 | 8 | 0/8 | `GET/POST /api/me/cover-letters`; `GET/PATCH/DELETE /api/me/cover-letters/{coverLetterId}`; `GET/POST /api/me/cover-letters/{coverLetterId}/versions`; `GET /api/me/cover-letters/{coverLetterId}/versions/{versionId}` |
| A16 문서 분석 | 6 | 0/6 | `POST/GET/DELETE /api/me/resumes/{resumeId}/versions/{versionId}/analysis`; 같은 세 메서드의 `/api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis` |
| A17 면접 일정 | 6 | 0/6 | `GET/POST /api/me/interviews`; `GET/PATCH /api/me/interviews/{interviewId}`; `POST /api/me/interviews/{interviewId}/cancel`; `POST /api/me/interviews/{interviewId}/reactivate` |
| A18 학습 목표 | 6 | 0/6 | `GET/POST /api/me/learning-goals`; `GET/PATCH/DELETE /api/me/learning-goals/{goalId}`; `PATCH /api/me/learning-goals/{goalId}/completion` |
| A19 앱 내 알림 | 4 | 0/4 | `GET/PUT /api/me/notification-preferences`; `GET /api/me/notifications`; `PATCH /api/me/notifications/{id}/read` |
| A20 의미 기반 추천 | 3 | 0/3 | `POST /api/me/recommendations/jobs`; `GET /api/me/recommendations/jobs?requestId={id}`; `GET /api/me/recommendations/jobs/{id}` |
| A21 계정 삭제 | 2 | 0/2 | `GET /api/auth/me/deletion-impact`; `DELETE /api/auth/me` |
| A22 관리자 ALIO 배치 | 2 | 0/2 | `POST/GET /api/admin/jobs/collections/alio` · 관리자 전용 |

현재 연결 56/108, 미연결 52/108이다. `frontend/src/App.tsx`에는 P01~P12 중 기존 경로와 P19 일부만 있다. P00, P13~P18, P20의 화면/라우트는 없다. A19와 A21은 P19 설정에서도 미연결이다. 기존 API 모듈에는 각 연결 기능의 단위 테스트가 있으며, 새로운 기능 A14~A22의 전용 프론트 테스트는 없다.

### 확인된 차이와 영향

1. [실행 계획](frontend-redesign-implementation-plan.md)의 현황과 [요구사항 P03/A07](frontend-redesign-requirements.md)은 사용자 ALIO 수집을 현재 버튼 범위로 설명하지만, `JobController.collectAlio`에는 내부 수집 엔드포인트라는 주석이 있고 `frontend/src/api/jobs.ts`, `JobsPage.tsx`에는 호출·버튼이 없다. Method·Path 자체는 A07과 일치한다. F03에서 P03의 수동 수집 행동을 현재 기능으로 간주할 수 없으므로, 실제 제공 범위와 권한을 재확인해야 한다.
2. Backend `CharacterState` DTO는 `progress: {level,totalExp,levelExp,nextLevelExp}`를 반환하지만 `frontend/src/api/character.ts`의 `CharacterState`에는 해당 필드가 없다. 현행 파서는 추가 필드를 허용해 기존 장착 화면을 막지는 않는다. P12의 레벨·EXP 표시는 이 타입과 화면을 함께 확장해야 한다.
3. P00 요구사항은 인증되지 않은 `#/`에 공개 홈을 요구하지만 `App.tsx`는 `#/login`으로 이동한다. 이는 F01/F02의 예정된 화면 동작 차이이며 Backend 계약 변경은 필요 없다.

그 밖에 확인한 Controller Method·Path와 A01~A22 사이의 불일치는 없다. 미연결 항목은 아직 화면이 없는 구현 범위이며 API 계약 불일치로 분류하지 않는다.

## 2. 이미지 준비 상태

[이미지 산출물 목록](redesign-image-manifest.md)과 `frontend/src/assets/redesign/`, `frontend/src/assets/character/`, `docs/assets/`를 확인했다. 현재 화면용 BRAND-01/02, CUR-01~14, EXT-IMG-01~08 계열과 캐릭터 조합·썸네일 파일이 있다. `CUR-10`은 화면용 배치 이미지가 아닌 참조 시트다. `CUR-15` 공개 홈 전용 장면은 요구사항대로 아직 없다. 아래는 화면 배치 후보이며 실제 배치·모바일 잘림·대체 텍스트 검증을 뜻하지 않는다.

| 페이지 | 재사용 후보 | 부족하거나 배치 시 확인할 위치 |
| --- | --- | --- |
| P00 | BRAND-01/02, CUR-11 | 공개 홈 소개 장면 CUR-15 없음 |
| P01 | CUR-01, BRAND-02 | 모바일 장면 잘림·폼 가독성 |
| P02 | CUR-02/03/11 | 실제 KPI·다음 행동 카드에서 장식과 데이터 분리 |
| P03 | CUR-04, EXT-IMG-07 | 출처별 중립 장식 필요 여부; 회사 로고 생성 불가 |
| P04 | CUR-05 | 수집/직접 등록 구분은 코드 배지 |
| P05 | CUR-06 | 실제 상태·결과는 코드 텍스트 |
| P06 | CUR-07, EXT-IMG-02 | 숙련도 값은 서버 데이터 |
| P07 | CUR-08 | 프로젝트별 가상 성과 이미지 사용 불가 |
| P08 | EXT-IMG-03 | 빈 상태 배치 적합성 |
| P09 | EXT-IMG-05A | 실제 기업 로고 없음 |
| P10 | CUR-09 | 분석 수치는 코드/표로 표시 |
| P11 | CUR-09, EXT-IMG-04 | 분포·추이 차트는 실제 응답으로 작성 |
| P12 | 캐릭터 완성 이미지·썸네일, CUR-13, EXT-IMG-06B | 서버 `assetId` 매핑·보상 조건과 세로 배경 배치 확인 |
| P13 | EXT-IMG-05B/08 | 원문 노출 범위와 장식 분리 |
| P14 | EXT-IMG-08/05B | 이력서와 구분되는 전용 장식 필요 여부 |
| P15 | EXT-IMG-05C | 확정 전 일정/결과 암시 금지 |
| P16 | EXT-IMG-05D | 완료·기술 획득을 이미지로 암시 금지 |
| P17 | CUR-14, EXT-IMG-01 | 알림 목록 맥락에 맞는 별도 장식 필요 여부 |
| P18 | EXT-IMG-08, CUR-12 | 점수·합격 확률 이미지 사용 금지 |
| P19 | CUR-14, EXT-IMG-01 | 보안/알림 설정의 성공 상태는 서버 응답으로 표시 |
| P20 | EXT-IMG-07 | 수집 성공·기관 보증 암시 금지 |

## 3. F01~F08 공유 타입·라우트 경계

- F01은 `App.tsx`의 인증 분기와 라우트 틀, `Layout.tsx` 메뉴, `styles.css`, 공통 상태 컴포넌트, `api/index.ts`를 소유한다. `#/`은 인증 조회 중 비노출, 401이면 P00, 인증 성공이면 P02, 그 외 오류면 재시도다. `#/states`는 개발용으로 유지한다.
- F02는 P00/P01/P02/P19를 채우고 A19의 **수신 설정**(`NotificationPreferences`: 두 Boolean)과 A21 삭제 흐름을 담당한다. F08은 A19의 **목록/읽음**(`NotificationPage`, `NotificationDto`)과 P20을 담당한다. 알림 `type`은 `INTERVIEW_REMINDER | TODO_REMINDER`, `sourceId`는 P15 또는 P08 상세 링크로 해석한다. 설정/목록의 API 타입은 한곳에서 정의하고 같은 파일을 병렬 수정하지 않는다.
- F03은 공용 공고 `jobId`와 개인 공고 `id`를 구분한 `kind: COLLECTED | MANUAL` 후보 타입을 F07에 제공한다. P04의 `#/bookmarks/{manualId}`와 P05의 `#/applications/{id}` 라우트를 F01 틀에 맞춘다. F07은 추천 후보 `{kind,id}`와 별도 `RecommendationPage`를 사용하며 기존 `matchRate`와 섞지 않는다.
- F04는 P06~P09와 `#/interviews`, `#/interviews/{id}`를 담당한다. 면접 알림의 `sourceId` 링크는 F08과 공유하되 지원 `nextScheduleAt`과 자동 연동한다고 가정하지 않는다. 기술 검색/`Skill`은 기존 A03 타입을 F05와 재사용한다.
- F05는 P10/P11과 `#/learning-goals`, `#/learning-goals/{id}`를 담당한다. Skill Gap 결과와 저장된 LearningGoal은 다른 타입이며, A10의 분석 표본·미상값을 그대로 표시한다.
- F06은 P12~P14를 담당한다. 문서 선택은 `{documentType, documentId, versionId}` 또는 추천 요청의 `resumeVersionId`/`coverLetterVersionId`를 구분해 F07에 제공한다. 문서 원문은 선택 버전 상세에서만 다룬다. `CharacterState.progress`는 Backend DTO 기준으로 타입을 보강한다.
- F08 관리자 P20은 `#/admin/alio`이며 일반 메뉴에 두지 않는다. A22의 403 응답으로 제어를 숨기고 권한을 임의 추정하지 않는다. 새 라우트의 제목·활성 메뉴·직접 진입 처리는 F01의 공통 경계에서 관리한다.

## 4. 기준선 검증

- `pnpm build`와 `pnpm test`를 `frontend/`에서 실행했다. 둘 다 의존성 확인/설치 단계에서 `https://registry.npmjs.org` 접근 `EACCES`가 반복되어 완료되지 않았다. `frontend/node_modules/.bin/tsc.CMD`, `vite.CMD`가 없어 빌드 자체는 실행되지 않았다. 실패 원인은 코드 컴파일 결과로 해석할 수 없다.
- 설치가 필요 없는 `node --test tests/*.test.mjs`는 73개 통과, 0개 실패였다. 이는 `pnpm test`와 같은 테스트 파일 패턴을 직접 실행한 결과다.
- 빌드 산출물이 없고 실행 중인 프론트 화면을 확인할 수 없어 F00의 현재 화면 스크린샷과 뷰포트 검증은 미실행이다. 후속 단계에서 의존성 접근 가능 시 `pnpm build`, `pnpm test`와 화면 캡처를 다시 수행해야 한다.
- `git diff --check` 통과. 기록 외 코드·자산·API·DB 변경 없음.
