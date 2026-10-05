package com.devjob;

import java.sql.Connection;
import javax.sql.DataSource;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import com.devjob.common.error.ApiError;
import static org.assertj.core.api.Assertions.assertThat;

@Tag("database")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DatabaseConnectionTest {
    @Autowired DataSource dataSource;
    @Autowired TestRestTemplate http;

    @Test
    void realHttpServerUsesJsonErrorContract() {
        var response = http.getForEntity("/api/s01-missing", ApiError.class);
        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).isEqualTo(new ApiError("NOT_FOUND", "요청한 대상을 찾을 수 없습니다."));
        var errorResponse = http.getForEntity("/error", ApiError.class);
        assertThat(errorResponse.getStatusCode().value()).isEqualTo(500);
        assertThat(errorResponse.getBody()).isEqualTo(new ApiError("INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다."));
    }

    @Test
    void applicationStartsWithPostgresqlAndFlyway() throws Exception {
        try (Connection connection = dataSource.getConnection();
                var statement = connection.createStatement()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            try (var result = statement.executeQuery("select 1")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt(1)).isEqualTo(1);
            }
            try (var result = statement.executeQuery(
                    "select count(*) from flyway_schema_history where success = false")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt(1)).isZero();
            }
            try (var result = statement.executeQuery("show server_encoding")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("UTF8");
            }
        }
    }
}
