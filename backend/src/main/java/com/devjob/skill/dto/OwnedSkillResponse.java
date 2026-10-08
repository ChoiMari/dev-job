package com.devjob.skill.dto;

import com.devjob.skill.entity.UserSkill;

public record OwnedSkillResponse(Long id, String name, Integer proficiencyLevel, Integer experienceMonths) {
    public static OwnedSkillResponse from(UserSkill owned) {
        return new OwnedSkillResponse(owned.getSkill().getId(), owned.getSkill().getName(),
                owned.getProficiencyLevel(), owned.getExperienceMonths());
    }
}
