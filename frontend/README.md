# DevJob Frontend · S02

S02는 React 실행 환경과 공통 기반만 제공합니다. 실제 서비스 기능과 Backend 호출은 기본 화면에서 실행하지 않습니다.

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

`src/api/index.ts`의 `apiRequest`는 `VITE_API_BASE_URL`을 사용합니다. 기본값 `/api`는 API 명세의 기본 경로이며 Backend 주소·포트나 Vite proxy를 임의로 정하지 않습니다. Backend가 준비되면 `.env.example`을 `.env.local`로 복사하고 공개 API URL만 설정합니다. `VITE_*` 값은 브라우저에 공개되므로 Secret을 넣지 않습니다. 교차 출처 접근 정책은 Backend와 함께 확정해야 합니다.

공통 클라이언트는 성공 리소스 JSON을 그대로 `unknown`으로 반환합니다. 이후 기능에서 응답을 검증·좁혀 사용해야 합니다. `{ data: ... }` 같은 래퍼를 추가하지 않습니다. 204는 `undefined`, 공통 오류 `{ code, message }`는 `ApiError`로 전달합니다. 명세 밖 오류·HTML·깨진 JSON·네트워크 실패는 공통 메시지로 처리하며 `AbortSignal` 취소는 그대로 전파합니다.

인증 전달 방식은 미확정입니다. 현재 클라이언트는 `credentials: 'omit'`로 쿠키를 전송하지 않고 토큰·저장소·401 리다이렉트도 구현하지 않습니다. S03에서 계약을 확정한 뒤 인증 처리를 추가해야 합니다. 공통 상태 미리보기는 UI 표시만 확인하며 실제 API 성공·실패를 의미하지 않습니다.

## 검증

`pnpm build`는 TypeScript 검사와 프로덕션 빌드를 수행합니다. `pnpm test`는 Node 기본 테스트 러너와 주입된 모의 fetch로 공통 API 계약, 204, 오류·네트워크·취소를 검증하며 실제 API에 접속하지 않습니다. 테스트의 `/example`은 테스트 전용 경로입니다.

브라우저에서는 기본 화면 → 공통 상태 확인 → 각 상태 선택 → 오류의 다시 시도, 뒤로/앞으로, 새로고침, `#/missing` 안내, 좁은 화면 레이아웃을 확인합니다.
