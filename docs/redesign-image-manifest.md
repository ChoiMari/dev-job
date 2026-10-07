# 프론트 개편 이미지 산출물 목록

상태: 이미지 제작 완료, 화면 연결 전 · 2026-10-08

제작 기준은 [이미지 제작 가이드](image-generation-brief.md), 스타일 참고는 [참고 이미지](assets/frontend-redesign-reference.png)다. 모든 이미지는 내장 `image_gen`으로 새로 생성해 [`frontend/src/assets/redesign/`](../frontend/src/assets/redesign/)에 저장했다. 참고 이미지의 문구·수치·가상 UI는 생성 이미지에 사용하지 않았다. 기존 `frontend/src/assets/illustrations/` 파일은 수정하지 않았다.

## 공통 제작 프롬프트

장식 에셋은 가이드의 해당 ID를 기준으로 **한 이미지에 한 용도**로 제작했다. 공통 지시는 선명한 픽셀 가장자리, 남보라 외곽선, 연보라·크림·민트·복숭아 팔레트, 여백이 있는 단독 구도였다. 글자·숫자·로고·버튼·입력·가상 데이터·워터마크는 제외했다. 소품은 `cur-03-next-action.png`, 캐릭터는 `cur-10-character-sheet.png`, 배경은 `cur-01-login-scene.png`를 후속 생성의 시각 참조로 사용했다. 투명 이미지에는 이미지 생성 도구의 `transparent_background: true`를 지정했다. 개별 피사체·제외 조건은 [가이드의 에셋 표](image-generation-brief.md#4-현재-화면용-에셋-목록)에 따른다.

브랜드 로고에는 같은 픽셀 색과 외곽선을 적용했다. 가방·새싹·꽃 심벌을 먼저 만들고, 이를 참조해 `DEVJOB` 글자를 정확히 한 번 표시한 가로형을 제작했다. 어두운 배경용 밝은 글자 버전은 가장자리 잡티가 있어 산출물에서 제외했다.

## 브랜드 로고

| ID | 파일 | 크기 | 사용 후보 | 배경 |
| --- | --- | --- | --- | --- |
| BRAND-01 | `brand-devjob-symbol.png` | 1254×1254 | 작은 헤더·모바일·짙은 사이드바의 심벌 | 투명 |
| BRAND-02 | `brand-devjob-wordmark-dark.png` | 2172×724 | 밝은 로그인·헤더의 가로형 로고 | 투명 |

짙은 사이드바의 글자는 BRAND-01 옆에 `DEVJOB`을 밝은 CSS 텍스트로 렌더링한다. 이미지 자체의 크기가 아니라 실제 배치 크기로 축소해 가독성을 확인한다.

## 현재 화면용

| ID | 파일 | 크기 | 사용 후보 | 배경 |
| --- | --- | --- | --- | --- |
| CUR-01 | `cur-01-login-scene.png` | 1024×1536 | 로그인·회원가입 장면 | 장면 |
| CUR-02 | `cur-02-dashboard-scene.png` | 1536×1024 | 대시보드 배너 | 장면 |
| CUR-03 | `cur-03-next-action.png` | 1254×1254 | 다음 행동 카드 | 투명 |
| CUR-04 | `cur-04-job-search.png` | 1254×1254 | 채용공고 검색·상세 | 투명 |
| CUR-05 | `cur-05-saved-jobs.png` | 1254×1254 | 관심 공고 | 투명 |
| CUR-06 | `cur-06-applications.png` | 1254×1254 | 지원 목록·상세 | 투명 |
| CUR-07 | `cur-07-profile.png` | 1254×1254 | 프로필·기술 | 투명 |
| CUR-08 | `cur-08-projects.png` | 1254×1254 | 프로젝트 목록·상세 | 투명 |
| CUR-09 | `cur-09-analysis.png` | 1254×1254 | Skill Gap·시장 분석 | 투명 |
| CUR-10 | `cur-10-character-sheet.png` | 1536×1024 | 캐릭터 시각 기준, 제품 화면에 통째로 배치하지 않음 | 투명 |
| CUR-11 | `cur-11-character-welcome.png` | 1024×1536 | 안내·빈 상태의 단독 캐릭터 | 투명 |
| CUR-12 | `cur-12-character-thoughtful.png` | 1536×1024 | 분석·안내 영역의 생각하는 캐릭터 | 투명 |
| CUR-13 | `cur-13-character-backdrop.png` | 1024×1536 | 현재 캐릭터 화면의 세로형 배경 | 장면 |
| CUR-14 | `cur-14-settings.png` | 1254×1254 | 현재 설정 화면 | 투명 |

CUR-11~14는 기준 시트만으로 현재 화면에 배치할 이미지와 설정 장식이 부족해 추가했다. CUR-13은 **세로형**이므로 캐릭터 화면의 세로 패널에서 사용하고 넓은 가로 배너에 강제로 늘리지 않는다. CUR-10은 제작 참조 시트다.

## 확장 기능용

기능 구현 전에는 아래 이미지를 화면에 노출하지 않는다. 각 이미지의 의미는 [확장 요구사항](extension-requirements.md)과 [확장 UI 명세](extension-ui-spec.md)를 따른다.

| ID | 파일 | 크기 | 사용 후보 |
| --- | --- | --- | --- |
| EXT-IMG-01 | `ext-img-01-account-settings.png` | 1254×1254 | 계정 설정 |
| EXT-IMG-02 | `ext-img-02-skill-levels.png` | 1254×1254 | 기술 숙련도 |
| EXT-IMG-03 | `ext-img-03-personal-todos.png` | 1254×1254 | 개인 할 일 빈 상태 |
| EXT-IMG-04 | `ext-img-04-expanded-analytics.png` | 1254×1254 | 확장 분석 |
| EXT-IMG-05A | `ext-img-05a-companies.png` | 1254×1254 | 기업 관리 |
| EXT-IMG-05B | `ext-img-05b-resumes.png` | 1254×1254 | 이력서 관리 |
| EXT-IMG-05C | `ext-img-05c-interviews.png` | 1254×1254 | 면접 일정 |
| EXT-IMG-05D | `ext-img-05d-learning.png` | 1254×1254 | 학습 관리 |
| EXT-IMG-06A | `ext-img-06a-character-base.png` | 1024×1536 | 캐릭터 꾸미기 기본 포즈 미리보기 |
| EXT-IMG-06B | `ext-img-06b-growth-celebration.png` | 1024×1536 | 실제 성장·보상 결과 장면 |
| EXT-IMG-07 | `ext-img-07-source-exploration.png` | 1254×1254 | 채용 출처 확장 |
| EXT-IMG-08 | `ext-img-08-ai-analysis.png` | 1254×1254 | AI 문서 분석 대기·안내 |

확장용 12개 파일은 모두 투명 배경이다. EXT-IMG-06A는 **기본 포즈 미리보기**다. 의상·소품의 분리 레이어 및 동일 좌표 규격은 아직 정해지지 않았으므로 이 이미지에 임의 레이어를 합성하지 않는다. EXT-IMG-06B는 실제 성장/보상 상태가 구현됐을 때만 사용한다.

## 적용·검증 기록

- 생성 이미지 28개를 파일별로 저장했다. 파일 존재, 해상도, PNG 좌상단 픽셀의 알파 채널을 확인했다. 장면 3개는 불투명, 투명 이미지 25개는 좌상단 알파 0~1이었다.
- 이미지 안의 장식적 빈 서식·추상 도형은 실제 사용자 데이터, 완료 상태, 통계로 해석하지 않는다. 실제 텍스트·상태·차트는 프론트 코드와 API 데이터로 표시한다.
- 아직 프론트 컴포넌트에 연결하거나 화면별 Desktop·Tablet·Mobile 배치를 검증하지 않았다. 연결 작업 시 장식 이미지의 `alt=""`, 반응형 자르기, 텍스트 대비, 작은 크기에서의 실루엣을 확인한다.
