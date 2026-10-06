# S13 공고별 역량 비교 검증 (2026-10-06)

main 통합 메모 (2026-10-07): S13 worktree 커밋 `e2e06d3`을 S14 통합본 뒤에 적용했다. main Backend build·일반 테스트 94건, Frontend build·테스트 49건이 통과했다. 새 격리 PostgreSQL `devjob_s13_test`에서 Flyway V1~V8·JPA `validate`와 DB 테스트 실행 19건을 확인했고, 별도 `devjob_s14_test`에서 S14 집계 회귀 2건도 통과했다. 아래 브라우저 확인은 S13 worktree 당시 기록이며 main 통합에서 재실행하지 않았다.

## 구현

- `GET /api/jobs/{jobId}/match`는 완료된 분석의 공고 기술과 세션 사용자의 `UserSkill`·소유 프로젝트의 `ProjectSkill`을 공통 Skill ID로 비교한다. 필수·우대 각각의 일치/부족 기술과 반올림한 기술 일치도를 반환한다. 분석 미완료는 409, 공고 기술 없음과 사용자 기술 없음은 각각 구분된 `available: false` 응답이다.
- 공고 목록·상세의 `matchRate`는 계산 가능한 경우에만 채운다. 목록의 `skillId`·`minMatchRate`·`sort=matchRate`는 전체 후보에서 필터·정렬한 뒤 페이지를 자른다. 계산 불가 공고는 일치도 정렬에서 뒤에 둔다. 기존 북마크·지원 상태도 유지한다.
- 목록에서 표준 기술을 검색·선택하고 최소 일치도와 정렬을 적용한다. 상세는 분석 완료 뒤 일치/부족 기술을 표시하고, 데이터 부족·조회 실패 상태를 별도로 안내한다. 일치도는 합격 확률이 아님을 명시한다.

## 실행한 검증

- Backend `compileJava test --offline` 통과. 일반 테스트 전체가 통과했다.
- 격리 PostgreSQL 17 컨테이너의 `devjob_s13_test`에서 Flyway V1~V8 적용과 JPA 검증 후 `JobMatchDatabaseTest` 3개, 기존 `JobQueryDatabaseTest` 7개 통과. 사용자 기술과 프로젝트 기술의 중복 제거, 타 사용자 분리, 분석 전 409, 데이터 부족, 67%/33% 반올림, 최소 일치도 0과 1, 기술 필터, 정렬·페이지, 잘못된 입력을 검증했다. 테스트는 트랜잭션 롤백으로 격리했다.
- Frontend `pnpm build`와 `pnpm test` 47개 통과. 비교 응답 검증과 필터 Query 전달 테스트를 추가했다.
- 별도 임시 계정·공고를 넣은 격리 DB와 로컬 Backend/Vite에서 브라우저 확인: 분석 완료 공고의 목록 `기술 일치도 50%`, 기술 검색으로 Java 선택, `skillId=1&minMatchRate=50&sort=matchRate` 검색 결과 1건, 상세의 필수 Java 일치·우대 SQL 부족·일치도 50%와 목록 복귀 조건을 확인했다.

## 범위

- 실제 외부 AI 호출이나 배포 환경은 이번 검증에 포함하지 않았다. 비교는 S12에 저장된 분석 결과만 읽는다.
- 새 DB 테이블·migration은 없다. 임시 PostgreSQL 컨테이너와 테스트 계정은 검증용이며 종료 후 제거했다.
