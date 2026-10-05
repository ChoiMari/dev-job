# S05 기술 목록·정규화 구현 보고

2026-10-06. Worktree: `C:/Users/user/.codex/worktrees/3024/dev-job`, branch: `codex/s05-skills`, 기준 커밋: `fab6792`.

## 시작 상태와 범위

- main(`D:/workspace/dev-job`): `main...origin/main [ahead 8]`, 작업 파일 변경 없음. 현재 worktree: 같은 기준 커밋의 detached HEAD, 변경 없음. 현재 별도 worktree를 S05 전용으로 연결하고 브랜치만 생성했다.
- S05 로드맵, 요구사항·ERD·API·UI·관련 아키텍처와 흐름, 기존 구현·portfolio-log를 확인했다. S02-V 공통 디자인과 S03 세션·CSRF·보호 경로 계약을 유지했다.
- 커밋·push·main 통합·다른 worktree 쓰기·worktree 삭제·개발 DB 초기화를 수행하지 않았다.

## 구현과 정규화 경계

- Controller → Service → Repository와 Entity/API DTO를 분리했다. Skill, SkillAlias, UserSkill을 저장하고 인증된 표준/별칭 검색 및 내 기술 목록·추가·삭제를 제공한다.
- NFKC → Unicode 공백 축약·양끝 제거 → ROOT 소문자 키로 비교한다. 구두점은 보존한다. 공백만 있는 이름·100자 초과·제어/format 문자를 거부하며 JSON 타입도 엄격히 검사한다.
- `resolveForUser`는 명시적인 사용자 추가에서만 새 표준명을 생성한다. `resolveExisting`은 AI/외부 입력의 기존 목록 해석 전용이다. 후속 Adapter/AI 처리자는 자신의 형식·요구유형을 검증하고 미해결 기술을 처리한 뒤 표준 ID만 저장해야 한다. S05에서 외부 호출·AI·JobSkill 저장은 추가하지 않았다.
- 표준명도 별칭 테이블에 예약한다. DB 유일 키와 `INSERT … ON CONFLICT DO NOTHING`으로 동시 기술 생성 및 보유 관계 중복을 막는다. UserSkill 삭제는 공통 기술을 지우지 않는다. 사용자 선택은 서버 인증 주체에서만 한다.

## 변경 파일

- Backend 신규: `com/devjob/skill/entity/{Skill,SkillAlias,UserSkill}.java`, `repository/{SkillRepository,SkillAliasRepository,UserSkillRepository}.java`, `dto/{AddSkillRequest,SkillResponse}.java`, `service/{SkillName,SkillNormalizer,SkillService}.java`, `controller/SkillController.java`.
- Backend 신규 테스트: `skill/{SkillNameTest,SkillSecurityTest,SkillDatabaseTest,SkillConcurrencyDatabaseTest}.java`.
- DB 신규: `backend/src/main/resources/db/migration/V3__create_skills.sql`; migration README 수정.
- Frontend 신규: `src/api/skills.ts`, `src/components/ProfileSkills.tsx`, `src/components/ProfileSkills.css`, `tests/skills.test.mjs`.
- Frontend 연결 수정: `src/App.tsx`, `src/components/Layout.tsx`.
- 문서 수정: `docs/requirements.md`, `docs/erd.md`, `docs/api-spec.md`, `docs/ui-spec.md`, `docs/implementation-roadmap.md`, `docs/portfolio-log.md`; 이 보고 신규.

## 검증

- `gradlew.bat build dbTest --offline --no-daemon`: Backend build 성공. 일반 테스트 49개, 실행된 DB 테스트 15개 성공, S07 DB 테스트 8개는 `DB_NAME=devjob_s07_test` 가드로 skip. S05 일반 4개·DB 6개에서 입력·별칭·없는 ID·중복·소유권·동시 등록을 검증했다. 기존 S03 세션/CSRF/HTTP 및 JDBC/Flyway/JPA 회귀가 포함된다.
- `pnpm test`: 23개 성공. S05 클라이언트 4개는 추가→조회→삭제, CSRF/쿠키, 검색 인코딩·취소 전달, 응답 검증, 오류 무재시도를 확인했다.
- `pnpm build`: TypeScript와 Vite 프로덕션 빌드 성공. 새 제품 의존성·lockfile 변경 없음.
- 실제 브라우저에서 전용 로컬 계정을 가입·로그인하고 Postgres 검색→이름으로 추가→PostgreSQL Badge 확인→별칭 중복 오류→새로고침 조회→Mobile 삭제→새로고침 빈 목록을 확인했다. 서버와 DB를 실제로 사용했다.
- 미등록 이름 `S05 Browser Technology`의 검색 0건→사용자 추가→검색 1건→보유 관계 삭제를 확인했다. 로그아웃 후 `/profile` 접근은 로그인으로 이동했다. 검사 시 브라우저 error 로그는 비어 있었다. 실제 30분 만료 대기는 수행하지 않았다.
- 1440×1000, 768×1024, 390×844, 320×812에서 확인한 화면에 가로 넘침과 높이 44px 미만의 표시된 버튼·입력이 없었다. Desktop·Mobile 캡처를 확인했다. 실물 기기·배포 HTTPS는 미검증이다.

## 격리 DB와 Flyway 이력

통합 메모: S04 프로필 migration이 V3을 사용하므로 main에서는 기술 migration의 파일명만
`V4__create_skills.sql`로 조정한다. 아래 V3 이력은 S05 작업 당시 격리 DB의 실제 기록이며
변경하거나 복구하지 않았다. 이 DB에는 통합본을 직접 실행하지 않는다.

- 기존 개발 컨테이너 `devjob-postgres-1`의 5432 DB에는 접속·초기화하지 않았다. 신규 `devjob-s05-postgres-3024`의 PostgreSQL 17.11, host port 55435, DB `devjob_s05_test`를 사용했다. S05 DB 테스트는 이 DB 이름 가드와 `current_database()` 검사로 제한한다.
- 실제 `flyway_schema_history` 조회 결과:

| Version | Script | Checksum | Success |
| --- | --- | --- | --- |
| 1 | `V1__create_users.sql` | 1326388005 | true |
| 2 | `V2__create_job_collection.sql` | -599628458 | true |
| 3 | `V3__create_skills.sql` | -1515070125 | true |

V3는 기술 16개, 표준명 별칭 16개와 추가 별칭 7개를 초기 등록한다. 테스트로 생성된 데이터가 있는 격리 DB이며 개발 데이터로 사용하지 않는다. Backend 확인 포트는 18085, Frontend 확인 포트는 5175다. 병렬 화면 검증에서 같은 호스트의 JSESSIONID 쿠키는 포트 간 공유되므로 S05 화면은 `localhost:5175`, API proxy는 `127.0.0.1:18085`를 사용했다.

검증 완료 후 임시 Backend·Frontend 서버와 S05 DB 컨테이너를 중지했다. 컨테이너·격리 DB 데이터·Flyway 이력은 보존했다. 최종 main status는 시작 시와 같은 `main...origin/main [ahead 8]`이며 작업 파일 변경이 없다. Worktree에는 이 보고에 나열한 S05 변경만 남겼다. `git diff --check`와 수정 문서의 상대 Markdown 링크 검사도 통과했다.

## S04 공유 파일과 통합 주의사항

S04 worktree `af6e/dev-job`를 읽기 전용으로 확인했다. S04는 `ProfilePage.tsx`, `api/profile.ts`, 공통 라우팅·스타일과 `V3__create_profiles.sql`을 작업 중이었다.

| 파일/경계 | S05 변경 | 통합 방법 |
| --- | --- | --- |
| `frontend/src/App.tsx` | `/profile` 제목과 ProfileSkills 렌더링 | S04의 ProfilePage를 유지하고 그 화면에 기술 컴포넌트를 연결. 기존 인증 검사·만료 이벤트·로그아웃을 유지. `<ProfileSkills key={user.id} />`의 사용자별 초기화도 유지 |
| `frontend/src/components/Layout.tsx` | 프로필 메뉴 1개 | S04와 중복 메뉴를 만들지 않고 `/profile` 링크 하나로 통합 |
| `frontend/src/pages/ProfilePage.tsx` | S05에서 생성·수정하지 않음 | S04 폼 뒤의 형제 section으로 `<ProfileSkills />` 배치. 프로필 미설정·조회 오류와 관계없이 기술 관리를 사용할 수 있도록 ProfilePage의 조건부 렌더링 밖에 배치 |
| `frontend/src/styles.css`, `src/api/index.ts`, 인증 소스 | S05 변경 없음 | S04 변경을 유지. ProfileSkills는 전용 CSS와 기존 apiRequest를 사용하므로 공통 CSS/API export 수정 불필요 |
| `docs/api-spec.md`, `erd.md`, `ui-spec.md` | 기술 계약 추가·상태 갱신 | S04 프로필 계약과 S05 기술 절을 함께 유지. 전체 파일 덮어쓰기 금지 |
| `implementation-roadmap.md`, `portfolio-log.md` | S05 완료·검증 근거 | 각 작업의 기록을 함께 보존하고 통합 상태는 실제 main 검증 뒤 갱신 |
| Flyway V3 | S05 기술과 S04 프로필 버전 충돌 | 통합 순서에 따라 최종 버전을 재조정. 새 격리 DB에서 전체 migration과 JPA validate·프로필/기술 테스트를 재검증 |

이미 적용된 V3의 파일명/내용 변경은 기존 DB에서 checksum 또는 migration 누락 검증 실패를 일으킬 수 있다. main 적용 전에 DB별 이력을 확인하고 데이터 보존 계획을 별도로 결정한다. 이 작업에서는 `repair`, `clean`, 기존 이력 변경·개발 DB 초기화를 하지 않았다. S04 코드와 조합한 전체 화면·프로필/기술 회귀는 main 통합 시 필요하며 이번 S05 worktree 결과와 구분한다.
