package com.devjob.skill;

import com.devjob.skill.service.SkillName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class SkillNameTest {
    @Test void normalizesCaseWhitespaceAndUnicodeWithoutMergingPunctuation() {
        assertThat(SkillName.parse("  Ｓpring   Boot  ")).isEqualTo(new SkillName("Spring Boot", "spring boot"));
        assertThat(SkillName.parse("POSTGRES").key()).isEqualTo("postgres");
        assertThat(SkillName.parse("C++").key()).isNotEqualTo(SkillName.parse("C#").key());
        assertThat(SkillName.parse("a".repeat(100)).display()).hasSize(100);
    }
    @Test void rejectsEmptyOversizedControlAndInvisibleInput() {
        for (String input : new String[]{"", "   ", "a".repeat(101), "Java\u0000", "Java\n", "Ja\u200bva"}) {
            assertThatThrownBy(() -> SkillName.parse(input)).isInstanceOf(ResponseStatusException.class)
                    .extracting(e -> ((ResponseStatusException) e).getStatusCode().value()).isEqualTo(400);
        }
        assertThatThrownBy(() -> SkillName.parse(null)).isInstanceOf(ResponseStatusException.class);
    }
}
