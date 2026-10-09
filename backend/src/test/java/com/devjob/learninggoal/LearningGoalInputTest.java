package com.devjob.learninggoal;

import com.devjob.learninggoal.dto.LearningGoalInput;
import com.devjob.learninggoal.entity.LearningGoal;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class LearningGoalInputTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test void normalizesTitleAndRejectsAmbiguousTypes() throws Exception {
        var input = LearningGoalInput.from(json.readTree("{\"title\":\"  Java   심화  \"}"), true);
        assertThat(input.title()).isEqualTo("Java 심화");
        for (String body : new String[] {"{}", "{\"title\":null}", "{\"title\":\"   \"}",
                "{\"title\":\"x\",\"skillId\":1.5}",
                "{\"title\":\"x\",\"progressPercent\":\"100\"}",
                "{\"title\":\"x\",\"progressPercent\":101}",
                "{\"title\":\"x\",\"unknown\":true}"}) {
            assertThatThrownBy(() -> LearningGoalInput.from(json.readTree(body), true))
                    .isInstanceOf(ResponseStatusException.class);
        }
        assertThatThrownBy(() -> LearningGoalInput.from(json.readTree("{}"), false))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> LearningGoalInput.completion(json.readTree("{\"completed\":\"true\"}")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test void completionRequiresHundredPercentAndRepeatedRequestPreservesTimestamp() {
        var goal = new LearningGoal(null, null, "Java", null, 80);
        assertThatThrownBy(() -> goal.setCompleted(true)).isInstanceOf(IllegalStateException.class);
        goal.update(null, "Java", null, 100);
        var unchangedAt = goal.getUpdatedAt();
        goal.update(null, "Java", null, 100);
        assertThat(goal.getUpdatedAt()).isEqualTo(unchangedAt);
        goal.setCompleted(true);
        var completedAt = goal.getCompletedAt();
        var updatedAt = goal.getUpdatedAt();
        goal.setCompleted(true);
        assertThat(goal.getCompletedAt()).isEqualTo(completedAt);
        assertThat(goal.getUpdatedAt()).isEqualTo(updatedAt);
        assertThatThrownBy(() -> goal.update(null, "Java", null, 99)).isInstanceOf(IllegalStateException.class);
        goal.setCompleted(false);
        assertThat(goal.getProgressPercent()).isEqualTo(100);
        assertThat(goal.getCompletedAt()).isNull();
    }
}
