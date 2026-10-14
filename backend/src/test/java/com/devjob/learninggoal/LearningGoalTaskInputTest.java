package com.devjob.learninggoal;

import com.devjob.learninggoal.dto.LearningGoalTaskInput;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class LearningGoalTaskInputTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void normalizesTitleAndAcceptsBooleanPatch() throws Exception {
        assertThat(LearningGoalTaskInput.from(json.readTree("{\"title\":\"  기초   학습  \"}"), true).title())
                .isEqualTo("기초 학습");
        assertThat(LearningGoalTaskInput.from(json.readTree("{\"completed\":true}"), false).completed())
                .isTrue();
    }

    @Test void rejectsUnknownOrInvalidInput() throws Exception {
        for (String body : new String[]{"{}", "{\"title\":\"\"}", "{\"completed\":\"true\"}",
                "{\"title\":\"ok\",\"completed\":true}", "{\"unknown\":1}"}) {
            assertThatThrownBy(() -> LearningGoalTaskInput.from(json.readTree(body), true))
                    .isInstanceOf(ResponseStatusException.class);
        }
        assertThatThrownBy(() -> LearningGoalTaskInput.from(json.readTree("{}"), false))
                .isInstanceOf(ResponseStatusException.class);
    }
}
