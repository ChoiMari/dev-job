package com.devjob.analysis;

import com.devjob.analysis.dto.SkillGapScore;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class SkillGapScoreTest {
    @Test void weightsRequiredTwiceAsMuchAsPreferredAndUsesAnalyzedJobsAsDenominator() {
        assertThat(SkillGapScore.calculate(4, 0, 5)).isEqualTo(80.0);
        assertThat(SkillGapScore.calculate(0, 4, 5)).isEqualTo(40.0);
        assertThat(SkillGapScore.calculate(2, 2, 5)).isEqualTo(60.0);
        assertThat(SkillGapScore.calculate(1, 0, 5)).isEqualTo(20.0);
    }
}
