package com.devjob.analysis;

import com.devjob.analysis.adapter.AnalysisGateway;
import com.devjob.analysis.service.AnalysisOutputValidator;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.*;

/** One explicit, low-volume paid request. No credential, prompt, or provider response is printed. */
@Tag("ai-live")
@EnabledIfEnvironmentVariable(named = "AI_LIVE_TEST", matches = "true")
@SpringBootTest
class AnalysisLiveTest {
    @Autowired AnalysisGateway gateway;
    @Autowired AnalysisOutputValidator validator;
    @Test void providerReturnsValidStructuredOutput() {
        var skills = validator.parse(gateway.analyze("Java backend developer", "Java is required. Docker is preferred."));
        assertThat(skills).isNotEmpty();
    }
}
