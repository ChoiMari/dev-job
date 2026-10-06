# S16 대시보드 검증

- 2026-10-07 Backend `compileJava`, 일반 `test` 통과.
- 격리된 일회용 PostgreSQL 17 `devjob_s16_test`에서 `DashboardDatabaseTest` 통과: 사용자별 지원 상태·북마크·행동 분리, 분석 완료 공고의 적합도 순 추천, 미지원 공고 제외, Skill Gap 미리보기, 인증 경계 확인. 테스트는 트랜잭션으로 롤백했고 개발 DB를 변경하지 않았다.
- Frontend `pnpm build`와 `pnpm test` 53건 통과. 대시보드 API의 빈 응답·형식 오류 및 인증된 GET 계약을 검사했다.
- 390px Edge Chromium의 프로덕션 빌드에서 대시보드 빈/데이터/오류·재시도, 지원/공고/역량 상세 이동 링크, 가로 넘침·JavaScript 오류 없음 확인. 브라우저는 모의 API 응답을 사용했다.
