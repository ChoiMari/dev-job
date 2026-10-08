# UI·사용자 흐름 대비 미구현 Backend API

2026-10-07 기준 `docs/ui-spec.md`, `docs/user-flow.md`의 후속 구상과 `backend/src/main/java`의 Controller, `docs/api-spec.md`를 대조했다. 아래 항목은 현재 프론트의 MVP 화면에 실제 호출을 추가하지 않는다. 경로·메서드·요청/응답 계약은 확정되지 않았으므로 임의로 정하지 않았다.

| 문서 근거 | 화면·흐름에서 언급된 기능 | 현재 Backend API 상태 | 프론트 처리 |
| --- | --- | --- | --- |
| `ui-spec.md` 2절 메뉴 예시의 기업 관리·이력서·면접 일정·학습 관리, `api-spec.md` 7절 | 별도 관리 화면 및 저장 | 해당 전용 API 없음. 면접 일정은 지원 건의 `nextScheduleAt`만 기존 지원 API로 관리 | 별도 관리 화면·요청을 추가하지 않음 |
| `ui-spec.md` UI-011 Settings | 알림 설정·계정 삭제 | 해당 API 없음. B01 비밀번호 변경 `PATCH /api/auth/password`는 구현됨 | `#/settings`는 기존 계정 기능과 비밀번호 변경을 제공하며 알림·계정 삭제는 표시하지 않음 |
| `ui-spec.md` 6.6절 및 UI-010, `user-flow.md` 32절 | 캐릭터 관리·성장·레벨·EXP·꾸미기 | 캐릭터 상태 조회·변경 API 없음. 현재 캐릭터는 프론트 정적 SVG | `#/character`에서 정적 캐릭터와 기존 준비 화면으로 가는 링크만 제공. 성장 상태를 표시하거나 저장하지 않음 |
| `ui-spec.md` UI-002의 후속 체크박스·EXP 예시, `user-flow.md` FLOW-017 | 별도 할 일 생성·완료 | 할 일 CRUD·완료 API 없음. 현재 `GET /api/dashboard`의 `nextActions`는 지원 상태·일정에서 도출 | 기존 읽기 전용 다음 행동 목록 유지 |
| `user-flow.md` FLOW-004 후속 구상 | 기술 숙련도·경험 입력 및 저장 | `POST /api/me/skills`는 기술 ID 또는 이름 등록만 제공하며 숙련도·경험 필드 API 없음 | 기술 검색·추가·삭제만 제공 |
| `ui-spec.md` UI-008의 후속 주요 데이터 예시 | 경력별 비율·지역별 분포·기간별 기술 수요 변화 | `GET /api/analytics/skills`는 기술별 집계와 기간·직무 필터만 제공. 해당 분포·추이 응답 API 없음 | 현재 기술별 수요 막대만 표시 |
| `user-flow.md` 채용공고 수집 흐름, `api-spec.md` 7절 | 사용자가 직접 실행하는 외부 수집·추가 출처 연동 | 청년일자리 출처의 세션·CSRF 보호 수동 POST 구현; 고용24 수집 API는 없음 | 공고 목록의 청년일자리 수집 버튼 구현. 다른 출처의 수집 UI는 후속 범위 |

현재 프론트가 호출하는 인증·프로필·기술·프로젝트·공고·북마크·지원·AI 분석·역량 비교·시장 분석·Skill Gap·대시보드 API는 Controller와 `docs/api-spec.md`에 존재한다. 이 문서는 기능 차이를 기록하며 신규 Backend API 명세나 구현 승인을 뜻하지 않는다.
