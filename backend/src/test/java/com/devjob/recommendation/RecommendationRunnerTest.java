package com.devjob.recommendation;

import com.devjob.documentanalysis.service.DocumentRedactor;
import com.devjob.recommendation.RecommendationService.Candidate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationRunnerTest {
    private final RecommendationRunner runner = new RecommendationRunner(mock(RecommendationGateway.class),
            mock(RecommendationCipher.class), new DocumentRedactor(), mock(JdbcTemplate.class), new ObjectMapper());
    private final Candidate job = new Candidate("MANUAL", 7, "백엔드", "Java 서버 운영", Instant.now(),
            null, false, "READY", null);

    @Test void acceptsOnlySourceBackedEvidenceAndACompleteRank() throws Exception {
        String valid = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"기술 관련성"}],
                  "limitations":["경력 연수는 확인할 수 없음"]}]}
                """;
        assertThat(runner.validate(valid, List.of("Java 경험"), List.of(job))).singleElement()
                .satisfies(item -> {
                    assertThat(item.status()).isEqualTo("COMPLETED");
                    assertThat(item.rank()).isEqualTo(1);
                    assertThat(item.evidence().get(0).jobQuote()).isEqualTo("Java 서버");
                });
        assertThatThrownBy(() -> runner.validate(valid.replace("Java 경험", "없는 경험"),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runner.validate(valid.replace("\"rank\":1", "\"rank\":2"),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class);
    }
}
