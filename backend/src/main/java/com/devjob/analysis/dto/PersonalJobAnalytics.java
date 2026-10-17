package com.devjob.analysis.dto;

import java.util.List;

public record PersonalJobAnalytics(long savedJobCount, long analyzedJobCount, List<SkillDemand> skills) {
    public record SkillDemand(String name, long jobCount, long requiredJobCount,
            long preferredJobCount, double ratio) { }
}
