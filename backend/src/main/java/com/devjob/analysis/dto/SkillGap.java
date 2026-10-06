package com.devjob.analysis.dto;

import java.util.List;

public record SkillGap(boolean available, String desiredRole, long analyzedJobCount, boolean provisional,
        long totalMissingSkills, List<SkillGapItem> items, String reason) {
    public static SkillGap unavailable(String role, long analyzedJobCount, String reason) {
        return new SkillGap(false, role, analyzedJobCount, false, 0, List.of(), reason);
    }
}
