package com.devjob.analysis.dto;

import com.devjob.skill.dto.SkillResponse;

public record SkillDemand(SkillResponse skill, long jobCount, long analyzedJobCount, double ratio) { }
