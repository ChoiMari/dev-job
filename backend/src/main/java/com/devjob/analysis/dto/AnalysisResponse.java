package com.devjob.analysis.dto;

import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.analysis.entity.JobSkill;
import com.devjob.skill.dto.SkillResponse;
import java.time.Instant;
import java.util.List;

public record AnalysisResponse(String status, List<SkillResponse> requiredSkills,
        List<SkillResponse> preferredSkills, Instant analyzedAt, String failureReason) {
    public static AnalysisResponse from(AIAnalysis analysis, List<JobSkill> skills) {
        if (analysis.getStatus() != AIAnalysis.Status.COMPLETED)
            return new AnalysisResponse(analysis.getStatus().name(), List.of(), List.of(), null, analysis.getFailureReason());
        return new AnalysisResponse("COMPLETED",
                skills.stream().filter(s -> s.getRequirementType() == JobSkill.RequirementType.REQUIRED)
                        .map(s -> SkillResponse.from(s.getSkill())).toList(),
                skills.stream().filter(s -> s.getRequirementType() == JobSkill.RequirementType.PREFERRED)
                        .map(s -> SkillResponse.from(s.getSkill())).toList(), analysis.getAnalyzedAt(), null);
    }
}
