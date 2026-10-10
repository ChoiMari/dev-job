# 프론트 개편 이미지 산출물 목록

상태: F09 화면 사용처 대조 · 2026-10-11

제작 기준은 [이미지 제작 가이드](image-generation-brief.md), 스타일 참고는 [참고 이미지](assets/frontend-redesign-reference.png)다. 기존 이미지들은 내장 `image_gen`으로 새로 생성해 [`frontend/src/assets/redesign/`](../frontend/src/assets/redesign/)에 저장했다. B09 의상 이미지 다섯 개는 `docs/assets/`에 추가했다. 참고 이미지의 문구·수치·가상 UI는 생성 이미지에 사용하지 않았다. 기존 `frontend/src/assets/illustrations/` 파일은 수정하지 않았다.

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

아래 이미지는 기능별 화면에서 실제 사용 여부를 확인한다. 각 이미지의 의미는 [확장 요구사항](extension-requirements.md)과 [확장 UI 명세](extension-ui-spec.md)를 따른다.

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
| EXT-IMG-06C | `docs/assets/ext-img-06c-character-mint.png` | 1024×1536 | B09 선택 가능 민트 의상 전체 이미지 |
| EXT-IMG-06D | `docs/assets/ext-img-06d-character-peach.png` | 1024×1536 | B09 카탈로그의 잠금 의상 전체 이미지; B10 전 장착 불가 |
| EXT-IMG-06E | `docs/assets/ext-img-06e-outfit-mint.png` | 1254×1254 | B09 민트 의상 선택 목록 이미지 |
| EXT-IMG-06F | `docs/assets/ext-img-06f-outfit-peach.png` | 1254×1254 | B09 복숭아 의상 선택 목록 이미지 |
| EXT-IMG-06G | `docs/assets/ext-img-06g-outfit-base.png` | 1254×1254 | B09 기본 의상 선택 목록 이미지 |
| EXT-IMG-07 | `ext-img-07-source-exploration.png` | 1254×1254 | 채용 출처 확장 |
| EXT-IMG-08 | `ext-img-08-ai-analysis.png` | 1254×1254 | AI 문서 분석 대기·안내 |

기존 확장용 PNG 17개 파일은 모두 투명 배경이다. EXT-IMG-06A는 **기본 포즈 미리보기**다. 이 완성 PNG에는 분리 레이어 좌표가 없으므로 새 착용 PNG 레이어를 위에 합성하지 않는다. EXT-IMG-06B는 실제 성장/보상 상태가 구현됐을 때만 사용한다.

B09에서 추가한 EXT-IMG-06C·06D는 EXT-IMG-06A를 참조해 만든 투명 배경의 **완성 캐릭터 변형**이다. 이전 B09 `assetId` 응답과 참조용으로 보존한다. 현재 화면은 아래의 조합별 완성 이미지를 표시한다. 이 두 이미지의 입력 프롬프트는 기본 캐릭터의 얼굴·머리·정면 포즈·픽셀 스타일을 유지하면서 각각 민트 후드·크림 바지·민트 신발, 복숭아 재킷·보라 치마·복숭아 신발로 의상만 바꾸고 투명 배경·글자 없음으로 만든 것이다. 내장 imagegen을 사용했다.

EXT-IMG-06E·06F·06G는 각각 민트·복숭아·기본 의상만 보여 주는 선택 목록 이미지다. 착용 이미지(06C·06D·06A)를 참조해 같은 옷 디자인·픽셀 스타일을 유지하고 사람·마네킹·문자 없이 투명 배경으로 생성했다. 카탈로그의 `thumbnailAssetId`가 이 목록 이미지를 가리킨다. `assetId`는 이전 완성 PNG ID로 유지한다. 세 파일도 `docs/assets/`에 두었고 내장 imagegen을 사용했다.

### B09 조합별 완성 이미지 (현재 화면)

의상 `BASE`·`MINT`·`PEACH`, 헤어 `CLASSIC`·`BOB`·`PONY`, 안경 `NONE`·`ROUND`·`SQUARE`의 27개 조합마다 착용 결과 PNG가 하나씩 있다. 파일명은 `character-{outfit}-{hair}-{glasses}.png`(소문자), 생성 원본은 `docs/assets/b09-complete-source/`, 화면용 파일은 `frontend/src/assets/character/`에 있다. 모두 공통 **1024×1536 투명 캔버스**다. 화면은 API `equipment` 세 값으로 파일을 고르며 이미지 여러 장을 합성하지 않는다. `PEACH` 조합 이미지도 준비됐지만 B10 전에는 서버가 장착을 거부한다.

기본 캐릭터·의상·헤어·안경은 각 완성 이미지에서 함께 그려져 머리 앞뒤, 눈의 안경 위치, 옷과 머리의 겹침이 조합별로 정리된다. `CLASSIC`은 짧은 기본 머리, `BOB`은 귀 길이 단발, `PONY`는 묶은 머리이며 모두 두 눈이 보인다. `ROUND`는 검정, `SQUARE`는 레드이고 `MINT` 후드의 목선은 열려 목이 보인다. 목록용 헤어·안경 이미지는 완성 이미지에서 따로 잘라 만든 256×256 `thumb-hair-{classic|bob|pony}.png`, `thumb-glasses-{none|round|square}.png`이고 의상 목록용 파일은 EXT-IMG-06E·06F·06G다. [`prepare-character-complete.cjs`](../frontend/scripts/prepare-character-complete.cjs)가 원본의 옅은 배경 알파를 제거하고 화면용 PNG와 목록 이미지를 내보낸다. 내장 imagegen으로 각 조합을 개별 생성했으며 작업용 `sharp`만 사용해 앱 런타임 의존성은 늘지 않았다.

토끼탈 `BUNNY`는 별도 전체 착용 이미지 `character-bunny.png`(자산 ID `B09-COMPLETE-BUNNY`) 하나를 사용한다. 헤어·안경이 보이지 않으므로 두 슬롯과의 조합 이미지를 추가하지 않는다. 목록용 `thumb-outfit-bunny.png`(자산 ID `B09-THUMB-OUTFIT-BUNNY`)는 머리 부분을 잘라 만든 256×256 PNG다. 원본 `docs/assets/b09-complete-source/character-bunny.png`를 기본 캐릭터의 정면 비율·픽셀 그림체 참조로 내장 imagegen에서 제작했고, 위 내보내기 스크립트로 1024×1536 투명 화면 파일을 만들었다.

보상 전체 의상 5종 `BEAR`(곰인형탈), `HOMEBODY`(츄리닝·안경·헝클어진 묶음머리), `INTERVIEW`(면접 정장), `RAINCOAT`(우비), `ASTRONAUT`(우주복)도 각각 `character-{item}.png` 1024×1536 완성 이미지와 `thumb-outfit-{item}.png` 256×256 목록 이미지를 가진다. 자산 ID는 `B09-COMPLETE-{ITEM}`·`B09-THUMB-OUTFIT-{ITEM}`이며 생성 원본은 `docs/assets/b09-complete-source/`에 있다. 기존 캐릭터를 그림체·정면 비율 참조로 내장 imagegen으로 각각 생성했고 [`prepare-character-complete.cjs`](../frontend/scripts/prepare-character-complete.cjs)로 투명 화면 PNG와 목록 이미지를 내보냈다. 승인된 시안이지만 B10 지급 조건 전에는 카탈로그에서 `FUTURE_REWARD` 잠금이며 장착할 수 없다.

### B09 분리 레이어 좌표·자산 (이전 화면 호환)

착용 레이어는 모두 원래 그림체를 참조한 투명 **1024×1536 PNG**다. 눈 중심은 대략 `(430, 410)`·`(595, 410)`, 의상 목·어깨 시작은 `y≈545`다. 원형 안경은 검정, 사각 뿔테는 레드다. DOM 및 API `layerAssetIds` 순서는 **헤어 뒤(0) → 얼굴·몸(1) → 의상(2) → 헤어 앞(3) → 안경(4, 미착용 시 생략)**이다. 내보낸 모든 레이어가 같은 크기·좌표이므로 CSS 위치 오프셋은 없다. 헤어·안경 선택 목록은 착용 레이어와 별개의 256×256 PNG이고, 의상 선택 목록은 기존 EXT-IMG-06E·06F·06G PNG를 Frontend 번들에 복사해 사용한다.

| 용도 | 자산 ID | `frontend/src/assets/character/` 파일 |
| --- | --- | --- |
| 공통 얼굴·몸 | `B09-LAYER-BODY` | `layer-body.png` |
| 의상 기본·민트·복숭아 | `B09-LAYER-OUTFIT-BASE/MINT/PEACH` | `layer-outfit-base/mint/peach.png` |
| 헤어 기본·단발·묶음 뒤 | `B09-LAYER-HAIR-CLASSIC/BOB/PONY-BACK` | `layer-hair-classic/bob/pony-back.png` |
| 헤어 기본·단발·묶음 앞 | `B09-LAYER-HAIR-CLASSIC/BOB/PONY-FRONT` | `layer-hair-classic/bob/pony-front.png` |
| 안경 검정 원형·레드 사각 뿔테 | `B09-LAYER-GLASSES-ROUND/SQUARE` | `layer-glasses-round/square.png` |
| 헤어 목록 기본·단발·묶음 | `B09-THUMB-HAIR-CLASSIC/BOB/PONY` | `thumb-hair-classic/bob/pony.png` |
| 안경 목록 미착용·동그란·네모 | `B09-THUMB-GLASSES-NONE/ROUND/SQUARE` | `thumb-glasses-none/round/square.png` |

원래 캐릭터 PNG를 참조해 내장 imagegen으로 각 투명 레이어를 제작했다. 생성 원본은 `docs/assets/b09-layer-source/`에 보존하고 [`prepare-character-png.cjs`](../frontend/scripts/prepare-character-png.cjs)에서 희미한 배경 알파를 제거하고 공통 좌표로 등록해 Frontend PNG와 별도 목록 이미지를 내보낸다. 이 내보내기와 조합 검증 스크립트는 작업용 `sharp`를 사용하며 앱 런타임에는 의존성을 추가하지 않는다. 기존 완성 PNG·의상 `assetId`와 API `layerAssetIds`는 삭제하거나 덮어쓰지 않는다. 현재 화면은 `thumbnailAssetId`로 선택 목록을 표시하고 `equipment`로 위의 완성 이미지를 선택한다. `PEACH` 자산은 준비돼 있지만 B10 보상 조건 전에는 서버에서 장착을 거부한다.

## 적용·검증 기록

### F09 실제 화면 사용 대조 (2026-10-11)

아래 경로는 모두 `frontend/src/assets/` 기준이다. 표의 크기는 원본 해상도가 아니라 CSS의 실제 표시 상한 또는 모바일 규칙이다. 장식 이미지는 빈 `alt`와 `aria-hidden`으로 처리하고 인접한 텍스트가 기능·상태를 전달한다. F09는 코드/CSS 대조이며 실제 브라우저의 픽셀 표시·실패 대체 화면은 확인하지 못했다.

| 사용 파일 | 화면·용도 | 표시 크기·접근성 |
| --- | --- | --- |
| `redesign/brand-devjob-wordmark-dark.png` | 공개 홈 브랜드 | 150×최대 44px, `alt="DevJob"` |
| `redesign/cur-15-public-home-scene.png` | 공개 홈 장면 | 가용 너비 100%, 767px 이하 높이 최대 360px, 장식 |
| `redesign/cur-01-login-scene.png` | 로그인·가입 장면 | 최대 530×700px 패널, 1023px 이하 숨김, 장식 |
| `illustrations/dashboard-hero.webp`, `illustrations/dashboard-desk.png` | 대시보드 히어로·다음 행동 제목 | 히어로 최대 460px(모바일 225/190px), 제목 52px, 장식. 준비된 `CUR-02/03` 대신 이 파일을 실제 사용 |
| `redesign/cur-04-job-search.png`, `redesign/ext-img-07-source-exploration.png` | 공고 목록·수집 공고 상세 | 너비 112~210×150px, 모바일 72px, 장식. EXT-IMG-07은 관리자 배치에서도 최대 132px |
| `redesign/cur-05-saved-jobs.png` | 관심 공고 목록·개인 상세 | 너비 112~210×150px, 모바일 72px, 장식 |
| `redesign/cur-06-applications.png` | 지원 목록·상세 | 너비 112~200×150px, 모바일 64px, 장식 |
| `redesign/cur-07-profile.png`, `redesign/ext-img-02-skill-levels.png` | 프로필·기술 | 각각 최대 150px, 96px(모바일 64px), 장식 |
| `redesign/cur-08-projects.png`, `redesign/ext-img-03-personal-todos.png`, `redesign/ext-img-05a-companies.png` | 프로젝트·할 일·기업 | 각각 96px(모바일 64px), 최대 180px(모바일 96px), 최대 140px(370px 이하 숨김), 장식 |
| `redesign/cur-09-analysis.png`, `redesign/ext-img-04-expanded-analytics.png`, `redesign/ext-img-05d-learning.png` | Skill Gap·시장 분석·학습 목표 | 각각 96→64px, 112→72px, 112→72px, 장식. 수치는 HTML 텍스트/표 |
| `redesign/cur-13-character-backdrop.png`, `redesign/ext-img-06b-growth-celebration.png` | 캐릭터 배경·보상 수령 | 각각 너비 최대 190px/높이 최대 235px(모바일 125px), 60×90px, 장식 |
| `character/character-*.png`, `character/thumb-*.png`, `character/ext-img-06{e,f,g}-outfit-*.png` | 장착 결과·카탈로그 | 완성 모습 최대 280px 너비·2:3, 썸네일 76px(모바일 64px). 완성 모습의 `role="img"`에 장착 상태 라벨, 내부 이미지 빈 `alt`; 목록 버튼에 품목명·잠금 상태 텍스트 |
| `redesign/ext-img-05b-resumes.png`, `redesign/ext-img-08-ai-analysis.png` | 이력서·자기소개서 헤더/분석·추천 | 문서 헤더 너비 최대 180×150px(모바일 90px), 분석 120px, 추천 헤더 최대 180×150px, 장식 |
| `redesign/cur-12-character-thoughtful.png` | 추천 동의 안내 | 최대 160px, 560px 이하 숨김, 장식 |
| `redesign/ext-img-05c-interviews.png`, `redesign/ext-img-01-account-settings.png`, `redesign/cur-14-settings.png` | 면접·알림·설정 | 각각 최대 180px(모바일 90px), 최대 132px, 120px(390px 이하 74px), 장식 |

`CUR-10`은 제작 참조 시트이고 `BRAND-01`, `CUR-02/03/11`, `EXT-IMG-06A/06C/06D` 등은 이 화면 코드에서 직접 불러오지 않는다. `CharacterLayers.tsx`가 실제 장착 PNG와 썸네일을 서버 자산 ID/장착값으로 선택한다.

- 생성 이미지 28개를 파일별로 저장했다. 파일 존재, 해상도, PNG 좌상단 픽셀의 알파 채널을 확인했다. 장면 3개는 불투명, 투명 이미지 25개는 좌상단 알파 0~1이었다.
- 이미지 안의 장식적 빈 서식·추상 도형은 실제 사용자 데이터, 완료 상태, 통계로 해석하지 않는다. 실제 텍스트·상태·차트는 프론트 코드와 API 데이터로 표시한다.
- B09 PNG 분리 레이어는 이전 화면에서 27개 합성판으로 검증했다. 품질 피드백 후 화면을 27개 개별 완성 PNG 선택으로 변경하고 [`render-character-complete-qa.cjs`](../frontend/scripts/render-character-complete-qa.cjs)로 실제 27개 완성 이미지의 조합판을 확인했다. 눈 위치와 앞·뒤 머리, 검정·레드 안경, 민트 후드 목선, 의상 겹침을 확인했다. Edge의 모의 API 화면에서 1280px·390px 선택·저장·새로고침·오류 복원, 이미지 로드와 가로 넘침도 확인했다. 다른 장식 이미지의 화면별 배치는 이 기록의 검증 범위 밖이다.
