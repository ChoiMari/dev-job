package com.devjob.analysis.dto;

import com.devjob.skill.dto.SkillResponse;

public record SkillGapItem(SkillResponse skill, long demandJobCount, long requiredJobCount,
        long preferredJobCount, double demandRatio, double priorityScore) { }
