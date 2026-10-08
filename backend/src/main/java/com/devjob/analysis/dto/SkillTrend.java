package com.devjob.analysis.dto;

import java.time.LocalDate;
import java.util.List;

public record SkillTrend(long skillId, String interval, List<Period> periods) {
    public record Period(LocalDate periodStart, long analyzedJobCount, long jobCount,
                         Double ratio, boolean insufficientSample) { }
}
