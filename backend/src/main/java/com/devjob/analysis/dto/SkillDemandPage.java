package com.devjob.analysis.dto;

import java.util.List;

public record SkillDemandPage(List<SkillDemand> items, int page, int size, long totalElements,
        long analyzedJobCount) { }
