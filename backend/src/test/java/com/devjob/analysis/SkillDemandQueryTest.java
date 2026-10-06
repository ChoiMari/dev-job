package com.devjob.analysis;

import com.devjob.analysis.dto.SkillDemandQuery;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class SkillDemandQueryTest {
    @Test void defaultsAndValidDates() {
        var query = new SkillDemandQuery(null, "2026-10-06", " 백엔드 ", null, null);
        query.validate();
        assertThat(query.page()).isZero();
        assertThat(query.size()).isEqualTo(20);
        assertThat(query.desiredRole()).isEqualTo("백엔드");
    }

    @Test void rejectsInvalidPeriodAndPage() {
        assertThatThrownBy(() -> new SkillDemandQuery("2026-10-07", "2026-10-06", null, 0, 20).validate())
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new SkillDemandQuery("2026-02-30", null, null, 0, 20).validate())
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new SkillDemandQuery(null, null, null, -1, 20).validate())
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> new SkillDemandQuery(null, null, null, 0, 101).validate())
                .isInstanceOf(ResponseStatusException.class);
    }
}
