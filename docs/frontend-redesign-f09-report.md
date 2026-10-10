# F09 프론트 통합 대조 (2026-10-11)

## 반영 기준과 통합

현재 작업 트리의 F02~F08 커밋(`971109b`~`6c62a30`)과 F03 별도 [완료 보고](frontend-redesign-f03-report.md), [실행 계획](frontend-redesign-implementation-plan.md), [요구사항](frontend-redesign-requirements.md)을 대조했다. 다른 단계의 별도 완료 보고 문서는 작업 트리에 없으므로 해당 커밋의 페이지·API·테스트를 근거로 삼았다. F09 시작 시 작업 트리는 깨끗했다.

`App.tsx`에 P00~P20의 보호 라우트·제목과 개인 공고 상세 경로를 연결했다. `Layout.tsx`는 실제 화면 메뉴와 상세 활성 상태를 표시한다. 관리자 배치는 직접 주소만 허용하고 GET/POST의 서버 403 처리에 맡긴다. 공통 `styles.css`에는 단일 `:root` 토큰 집합이 있어 충돌 수정을 하지 않았고, `api/index.ts`의 세션/CSRF 공통 진입점도 유지했다. 보호 API 401은 세션 만료 로그인으로 이동한다. 지원→면접에는 지원 ID를 전달하고, 설정→알림, 공고/관심 공고/문서→추천 링크를 연결했다. 추천 화면은 이전 화면의 선택을 자동 전송하지 않고 사용자가 재선택한다.

## A01~A22 메서드별 UI 연결 대조

표의 각 셀은 요구사항의 모든 Method·Path를 개별적으로 열거한다. `연결`은 정적 코드상 해당 화면이 API 함수에 도달할 수 있다는 뜻이며 종단 간 서버 성공을 뜻하지 않는다. `공통`은 CSRF 선행 호출 또는 세션 처리다.

| 묶음 | Method·Path와 UI 호출 위치 | 결과 |
| --- | --- | --- |
| A01 | `GET /api/auth/csrf` 공통 변경 요청; `POST /api/auth/register` 인증; `POST /api/auth/login` 인증; `POST /api/auth/logout` Layout/설정; `GET /api/auth/me` App; `PATCH /api/auth/password` 설정 | 모두 연결 |
| A02 | `GET /api/dashboard` 대시보드 | 연결 |
| A03 | `GET /api/me/profile` 프로필; `PUT /api/me/profile` 프로필; `GET /api/skills` 프로필/프로젝트/학습; `GET /api/me/skills` 프로필; `POST /api/me/skills` 프로필; `PATCH /api/me/skills/{skillId}/experience` 프로필; `DELETE /api/me/skills/{skillId}` 프로필; `GET /api/me/projects` 프로젝트; `POST /api/me/projects` 프로젝트; `GET /api/me/projects/{projectId}` 프로젝트; `PUT /api/me/projects/{projectId}` 프로젝트; `DELETE /api/me/projects/{projectId}` 프로젝트 | 모두 연결 |
| A04 | `GET /api/jobs` 공고/추천 후보; `GET /api/jobs/{jobId}` 공고 상세 | 모두 연결 |
| A05 | `POST /api/jobs/{jobId}/analysis` 공고 상세; `GET /api/jobs/{jobId}/analysis` 공고 상세; `GET /api/jobs/{jobId}/match` 공고 상세 | 모두 연결 |
| A06 | `GET /api/bookmarks` API 함수만 있고 UI에서는 사용하지 않음; `POST /api/bookmarks` 공고; `DELETE /api/bookmarks/{jobId}` 공고/관심 | **목록 GET 1건 UI 미연결**. 관심 화면은 A08 통합 목록을 사용 |
| A07 | `POST /api/jobs/collections/alio` | **UI 미연결**. F03 보고와 Controller의 내부 수집용 주석에 따라 사용자 버튼을 추가하지 않음 |
| A08 | `GET /api/me/saved-jobs` 관심/추천 후보; `POST /api/me/saved-jobs` 관심; `GET /api/me/saved-jobs/{id}` 개인 상세; `PUT /api/me/saved-jobs/{id}` 관심; `DELETE /api/me/saved-jobs/{id}` 관심; `POST /api/me/saved-jobs/{id}/analysis` 관심/상세; `GET /api/me/saved-jobs/{id}/analysis` 관심/상세 | 모두 연결 |
| A09 | `GET /api/applications` 지원 목록; `POST /api/applications` 공고/관심 등록; `GET /api/applications/{applicationId}` 지원 상세; `PATCH /api/applications/{applicationId}` 지원 상세; `PATCH /api/applications/{applicationId}/status` 지원 상세; `GET /api/applications/{applicationId}/history` 지원 상세 | 모두 연결 |
| A10 | `GET /api/analytics/skills` 시장; `GET /api/analytics/career-levels` 시장; `GET /api/analytics/locations` 시장; `GET /api/analytics/skills/trends` 시장; `GET /api/me/skill-gap` Skill Gap | 모두 연결 |
| A11 | `GET /api/me/todos` 할 일; `POST /api/me/todos` 할 일; `GET /api/me/todos/{todoId}` 할 일 상세; `PATCH /api/me/todos/{todoId}` 할 일 상세; `PATCH /api/me/todos/{todoId}/completion` 할 일; `DELETE /api/me/todos/{todoId}` 할 일 | 모두 연결 |
| A12 | `GET /api/me/companies` 기업; `POST /api/me/companies` 기업; `GET /api/me/companies/{companyId}` 기업 상세; `PATCH /api/me/companies/{companyId}` 기업 상세; `DELETE /api/me/companies/{companyId}` 기업 상세 | 모두 연결 |
| A13 | `GET /api/me/character` 캐릭터; `GET /api/character/items` 캐릭터; `PUT /api/me/character/equipment/{slot}` 캐릭터; `GET /api/me/character/activity` 캐릭터; `GET /api/me/character/quests` 캐릭터; `POST /api/me/character/quests/{questId}/claim` 캐릭터 | 모두 연결 |
| A14 | `GET /api/me/resumes` 이력서/추천 버전 선택; `POST /api/me/resumes` 이력서; `GET /api/me/resumes/{resumeId}` 이력서 상세; `PATCH /api/me/resumes/{resumeId}` 이력서 상세; `DELETE /api/me/resumes/{resumeId}` 이력서 상세; `GET /api/me/resumes/{resumeId}/versions` 이력서/추천; `POST /api/me/resumes/{resumeId}/versions` 이력서; `GET /api/me/resumes/{resumeId}/versions/{versionId}` 이력서 상세 | 모두 연결 |
| A15 | `GET /api/me/cover-letters` 자기소개서/추천 버전 선택; `POST /api/me/cover-letters` 자기소개서; `GET /api/me/cover-letters/{coverLetterId}` 자기소개서 상세; `PATCH /api/me/cover-letters/{coverLetterId}` 자기소개서 상세; `DELETE /api/me/cover-letters/{coverLetterId}` 자기소개서 상세; `GET /api/me/cover-letters/{coverLetterId}/versions` 자기소개서/추천; `POST /api/me/cover-letters/{coverLetterId}/versions` 자기소개서; `GET /api/me/cover-letters/{coverLetterId}/versions/{versionId}` 자기소개서 상세 | 모두 연결 |
| A16 | `POST /api/me/resumes/{resumeId}/versions/{versionId}/analysis` 이력서; `GET /api/me/resumes/{resumeId}/versions/{versionId}/analysis` 이력서; `DELETE /api/me/resumes/{resumeId}/versions/{versionId}/analysis` 이력서; `POST /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis` 자기소개서; `GET /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis` 자기소개서; `DELETE /api/me/cover-letters/{coverLetterId}/versions/{versionId}/analysis` 자기소개서 | 모두 연결 |
| A17 | `GET /api/me/interviews` 면접 목록; `POST /api/me/interviews` 면접 등록; `GET /api/me/interviews/{interviewId}` 면접 상세; `PATCH /api/me/interviews/{interviewId}` 면접 상세; `POST /api/me/interviews/{interviewId}/cancel` 면접 상세; `POST /api/me/interviews/{interviewId}/reactivate` 면접 상세 | 모두 연결 |
| A18 | `GET /api/me/learning-goals` 학습 목록; `POST /api/me/learning-goals` 학습 등록; `GET /api/me/learning-goals/{goalId}` 학습 상세; `PATCH /api/me/learning-goals/{goalId}` 학습 상세; `PATCH /api/me/learning-goals/{goalId}/completion` 학습 상세; `DELETE /api/me/learning-goals/{goalId}` 학습 상세 | 모두 연결 |
| A19 | `GET /api/me/notification-preferences` 설정; `PUT /api/me/notification-preferences` 설정; `GET /api/me/notifications` 알림; `PATCH /api/me/notifications/{id}/read` 알림 | 모두 연결 |
| A20 | `POST /api/me/recommendations/jobs` 추천 생성; `GET /api/me/recommendations/jobs?requestId={id}` API 함수만 있고 UI에서는 사용하지 않음; `GET /api/me/recommendations/jobs/{id}` 추천 결과 직접 주소 | **대체 조회 경로 1건 UI 미연결**. 두 GET은 같은 저장 결과의 대체 경로 |
| A21 | `GET /api/auth/me/deletion-impact` 설정; `DELETE /api/auth/me` 설정 | 모두 연결 |
| A22 | `POST /api/admin/jobs/collections/alio` 관리자 배치; `GET /api/admin/jobs/collections/alio` 관리자 배치 | 모두 연결, 권한 없는 계정은 GET 403으로 실행 제어 숨김 |

결론: 요구사항 표의 108개 업무 Method·Path 중 UI 도달 가능한 것은 105개다. A06의 이전 공용 목록 GET, A07 내부 수집 POST, A20의 대체 GET 3개는 위 이유로 남긴다. Backend·DB·REST 계약은 변경하지 않았다.

## 검증과 남은 범위

- `node --test tests/*.test.mjs`: 102건 통과. `git diff --check`: 통과.
- `pnpm build`, `pnpm test`: 기존 의존성 설치에서 npm 레지스트리 `EACCES`로 중단돼 빌드/스크립트 실행 결과가 없다. 직접 Node 테스트 결과와 구분한다.
- `node tests/b01-browser-flow.mjs`는 `playwright` 모듈이 없어 시작 전에 실패했다. Vite 서버도 시작할 수 없어 핵심 브라우저 흐름의 직접 진입·새로고침·뒤로 가기·세션 만료, 이미지 표시, 4개 뷰포트, 실제 Backend 종단 간 연결은 실행하지 못했다. 위 라우트/링크/요청 연결은 코드 대조 결과다.
