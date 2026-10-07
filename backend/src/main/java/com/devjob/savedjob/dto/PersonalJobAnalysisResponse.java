package com.devjob.savedjob.dto;

import java.time.Instant;
import java.util.List;

public record PersonalJobAnalysisResponse(String status, List<String> requiredSkills,
        List<String> preferredSkills, Instant analyzedAt, String failureReason) { }
