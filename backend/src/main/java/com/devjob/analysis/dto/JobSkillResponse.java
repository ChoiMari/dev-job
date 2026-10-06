package com.devjob.analysis.dto;

import com.devjob.analysis.entity.JobSkill;
import com.devjob.skill.dto.SkillResponse;

public record JobSkillResponse(SkillResponse skill, String requirementType) {
    public static JobSkillResponse from(JobSkill value) {
        return new JobSkillResponse(SkillResponse.from(value.getSkill()), value.getRequirementType().name());
    }
}
