package com.devjob.job.dto;

import com.devjob.skill.dto.SkillResponse;
import java.util.List;

public record JobMatch(boolean available, SkillGroup required, SkillGroup preferred, Integer matchRate, String reason) {
    public record SkillGroup(List<SkillResponse> matched, List<SkillResponse> missing, int total) { }
    public static JobMatch unavailable(String reason) {
        var empty = new SkillGroup(List.of(), List.of(), 0);
        return new JobMatch(false, empty, empty, null, reason);
    }
}
