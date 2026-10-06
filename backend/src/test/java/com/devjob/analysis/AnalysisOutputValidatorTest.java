package com.devjob.analysis;

import com.devjob.analysis.entity.JobSkill.RequirementType;
import com.devjob.analysis.service.AnalysisOutputValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AnalysisOutputValidatorTest {
    private final AnalysisOutputValidator validator = new AnalysisOutputValidator(new ObjectMapper());
    @Test void acceptsOnlyBoundedStructuredSkills() {
        var parsed = validator.parse("{\"skills\":[{\"name\":\" Postgres \",\"requirementType\":\"REQUIRED\"}]}");
        assertThat(parsed).hasSize(1);
        assertThat(parsed.get(0).name()).isEqualTo("Postgres");
        assertThat(parsed.get(0).type()).isEqualTo(RequirementType.REQUIRED);
        assertThat(validator.parse("{\"skills\":[]}")).isEmpty();
    }
    @Test void rejectsMalformedAndUnexpectedFieldsBeforePersistence() {
        for (String raw : new String[]{"bad", "[]", "{}", "{\"skills\":null}",
                "{\"skills\":[{\"name\":\"Java\",\"requirementType\":\"OTHER\"}]}",
                "{\"skills\":[{\"name\":\"Java\",\"requirementType\":\"REQUIRED\",\"extra\":1}]}",
                "{\"skills\":[],\"extra\":1}", "{\"skills\":[{\"name\":\"\\u0000\",\"requirementType\":\"REQUIRED\"}]}"})
            assertThatThrownBy(() -> validator.parse(raw)).isInstanceOf(IllegalArgumentException.class);
    }
}
