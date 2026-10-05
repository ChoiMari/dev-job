# Migration boundary

S01에는 도메인 테이블이나 seed SQL이 없다. Flyway는 빈 DB의 이력 테이블만 관리한다.
첫 Entity 단계부터 `V1__description.sql` 형식의 SQL을 추가한다.
JPA는 `validate`로 매핑을 검증하며 테이블을 생성하거나 갱신하지 않는다.
이미 적용된 migration은 수정하지 않고 후속 버전을 추가한다.
