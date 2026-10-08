# DevJob Frontend · MVP

통합본에는 가입·로그인부터 프로필·기술·프로젝트, 공고·CRM, AI 분석·역량 비교·시장 분석·Skill Gap·대시보드까지 연결했다. S03의 같은 출처 세션 쿠키·CSRF를 사용한다. 상세 계약은 [API 명세](../docs/api-spec.md)를 따른다. 아래 S02 설명은 초기 기반 구축 기록이다.

B03 개인 할 일은 `#/todos`에서 미완료·완료·전체 목록과 등록·상세·수정·완료·삭제를 제공한다. 대시보드에는 지원 기록의 다음 행동과 별도 미완료 할 일 목록을 표시한다. 입력·시간대·삭제 계약은 [확장 API 명세 B03](../docs/extension-api-spec.md#b03--개인-할-일--ext-03-확정)을 따른다.

초기 S02 기반 구성 당시에는 React 실행 환경과 공통 화면만 제공했습니다. 현재 기능 범위는 위의 MVP 설명과 API 명세를 따릅니다.

## 실행

Node.js 22.18 이상(또는 Node.js 24 LTS), pnpm이 필요합니다. `frontend/`에서 실행합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test
pnpm preview
```

개발 서버는 기본 `http://127.0.0.1:5173`, 빌드 미리보기는 기본 `http://127.0.0.1:4173`입니다. 포트가 사용 중이면 Vite 출력의 주소를 확인합니다.

## 이번 단계에서 확정한 선택

- 사용자 결정: TypeScript, Vite 수동 최소 구성.
- React와 React DOM, TypeScript, Vite와 React 플러그인, React 타입만 사용합니다.
- UI는 CSS, 이동은 해시 URL과 브라우저 기본 이력 기능, API 호출은 `fetch`입니다.
- `#/` 기본 화면, `#/states` 로딩·빈 화면·오류 미리보기, 알 수 없는 경로 안내를 제공합니다. 브라우저 뒤로/앞으로 이동과 새로고침을 지원합니다.
- Desktop은 Header + Sidebar + Main Content, 좁은 화면에서는 메뉴를 위에 배치합니다. 기능별 메뉴·검색·사용자 계정·알림은 해당 구현 단계에서 추가합니다.

## API 경계

`src/api/index.ts`의 `apiRequest`는 `VITE_API_BASE_URL`을 사용합니다. 기본값 `/api`는 API 명세의 기본 경로입니다. 개발 시 Vite는 `/api`를 `VITE_API_PROXY_TARGET`(기본 `http://127.0.0.1:8080`)으로 전달합니다. `.env.example`을 `.env.local`로 복사할 때 API 기본값을 `/api`로 유지합니다. `VITE_*` 값은 브라우저에 공개되므로 Secret을 넣지 않습니다. 배포 환경에서도 Frontend와 API는 같은 출처여야 합니다.

공통 클라이언트는 성공 리소스 JSON을 그대로 `unknown`으로 반환합니다. 이후 기능에서 응답을 검증·좁혀 사용해야 합니다. `{ data: ... }` 같은 래퍼를 추가하지 않습니다. 204는 `undefined`, 공통 오류 `{ code, message }`는 `ApiError`로 전달합니다. 명세 밖 오류·HTML·깨진 JSON·네트워크 실패는 공통 메시지로 처리하며 `AbortSignal` 취소는 그대로 전파합니다.

현재 클라이언트는 `credentials: 'same-origin'`으로 HttpOnly 세션 쿠키를 전달하고 변경 요청마다 CSRF 토큰을 준비합니다. 인증 실패 시 로그인 화면으로 이동하며 쿠키·CSRF 토큰을 브라우저 저장소에 보관하지 않습니다. 공통 상태 미리보기는 UI 표시만 확인하며 실제 API 성공·실패를 의미하지 않습니다.

## 검증

S17의 실제 Backend 화면 검증은 [S17 보고](../docs/s17-validation.md)의 일회용 DB fixture와 같은 출처 Vite proxy를 전제로 한다. 아래 스크립트는 별도로 설치된 기존 Playwright 모듈과 Edge를 사용하며 애플리케이션 의존성을 추가하지 않는다. HTTP 스크립트는 Node.js 기본 `fetch`만 사용한다.

```powershell
$env:S17_API_URL = 'http://127.0.0.1:8097'
node tests/s17-http-flow.mjs
$env:PLAYWRIGHT_MODULE = '<기존 playwright 모듈 절대 경로>'
$env:S17_FRONTEND_URL = 'http://127.0.0.1:5173'
node tests/s17-browser-flow.mjs
```

S06 프로젝트 관리는 로그인 후 `#/projects`에서 사용할 수 있다. 표준 기술을 선택해 등록하고
상세에서 수정·삭제한다. 프로젝트 기술은 보유 기술과 독립적으로 저장한다.
현재 S03 인증은 같은 출처 쿠키와 CSRF 토큰을 사용한다.

S06의 실제 브라우저 검증은 새 격리 `devjob_s06_test`를 사용하는 Backend(로컬 HTTP에서는
`SESSION_COOKIE_SECURE=false`)와 Vite proxy에서 실행한다. 테스트 계정·페이지 검사 프로젝트를
생성하므로 개발/운영 DB에는 실행하지 않는다. 기존 Playwright 설치를 사용하며 의존성을 추가하지 않는다.

```powershell
# Vite를 VITE_API_PROXY_TARGET=http://127.0.0.1:8086, 포트 5176으로 실행한다.
# 로컬 설치 경로에 맞춰 설정한다.
$env:PLAYWRIGHT_MODULE = '<기존 playwright 모듈 절대 경로>'
$env:S06_FRONTEND_URL = 'http://127.0.0.1:5176'
node tests/projects-flow.mjs
```

2026-10-06 `pnpm test` 33개·`pnpm build`, 실제 Edge 브라우저의 프로젝트 CRUD·새로고침·
기술 관계 독립성·20+1 페이지·오류 재시도·모바일 배치 검사가 통과했다.

`pnpm build`는 TypeScript 검사와 프로덕션 빌드를 수행합니다. `pnpm test`는 Node 기본 테스트 러너와 주입된 모의 fetch로 공통 API 계약, 204, 오류·네트워크·취소를 검증하며 실제 API에 접속하지 않습니다. 테스트의 `/example`은 테스트 전용 경로입니다.

브라우저에서는 기본 화면 → 공통 상태 확인 → 각 상태 선택 → 오류의 다시 시도, 뒤로/앞으로, 새로고침, `#/missing` 안내, 좁은 화면 레이아웃을 확인합니다.
