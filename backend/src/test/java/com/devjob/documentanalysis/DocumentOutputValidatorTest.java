package com.devjob.documentanalysis;

import com.devjob.documentanalysis.service.DocumentOutputValidator;
import com.devjob.documentanalysis.service.DocumentRedactor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DocumentOutputValidatorTest {
    private final DocumentRedactor redactor = new DocumentRedactor();
    private final DocumentOutputValidator validator = new DocumentOutputValidator(new ObjectMapper(), redactor);

    @Test void redactsStructuredPersonalDataBeforeExternalCall() {
        String source = "이름: 홍길동\nemail x@example.com, 010-1234-5678, 900101-1234567, https://example.com/me";
        String safe = redactor.redact(source);
        assertThat(safe).doesNotContain("홍길동", "x@example.com", "010-1234-5678", "900101-1234567", "example.com/me");
    }
    @Test void validatesAndNormalizesResult() {
        var result = validator.parse("{\"skills\":[\" Java \",\"Java\"],\"strengths\":[\" 협업 경험 \"],\"improvements\":[]}");
        assertThat(result.skills()).containsExactly("Java");
        assertThat(result.strengths()).containsExactly("협업 경험");
        assertThat(result.improvements()).isEmpty();
        assertThatThrownBy(() -> validator.parse("{\"skills\":[],\"strengths\":[\"x@example.com\"],\"improvements\":[]}"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> validator.parse("{\"skills\":[],\"strengths\":[],\"improvements\":[],\"score\":99}"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
