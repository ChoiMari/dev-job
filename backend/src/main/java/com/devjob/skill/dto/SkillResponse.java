package com.devjob.skill.dto;

import com.devjob.skill.entity.Skill;

public record SkillResponse(Long id, String name) {
    public static SkillResponse from(Skill skill) { return new SkillResponse(skill.getId(), skill.getName()); }
}
