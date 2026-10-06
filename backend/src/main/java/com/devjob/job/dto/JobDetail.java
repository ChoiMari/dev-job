package com.devjob.job.dto;

import com.devjob.job.entity.JobPosting;
import com.devjob.analysis.dto.JobSkillResponse;
import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.analysis.entity.JobSkill;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.time.LocalDate;
import java.util.List;

public record JobDetail(@JsonUnwrapped JobSummary summary, String description, LocalDate postedDate,
        String sourceUrl, List<JobSkillResponse> requiredSkills, List<JobSkillResponse> preferredSkills, AnalysisState analysis) {
    public record AnalysisState(String status) { }
    public static JobDetail from(JobPosting job) {
        return from(job, false, null);
    }
    public static JobDetail from(JobPosting job, boolean bookmarked) {
        return from(job, bookmarked, null);
    }
    public static JobDetail from(JobPosting job, String applicationStatus) {
        return from(job, false, applicationStatus);
    }
    public static JobDetail from(JobPosting job, boolean bookmarked, String applicationStatus) {
        return from(job, bookmarked, applicationStatus, null, List.of());
    }
    public static JobDetail from(JobPosting job, boolean bookmarked, String applicationStatus,
            AIAnalysis analysis, List<JobSkill> skills) {
        return new JobDetail(JobSummary.from(job, bookmarked, applicationStatus), job.getDescription(), job.getPostedDate(),
                job.getSourceUrl(), skills.stream().filter(s -> s.getRequirementType() == JobSkill.RequirementType.REQUIRED)
                        .map(JobSkillResponse::from).toList(),
                skills.stream().filter(s -> s.getRequirementType() == JobSkill.RequirementType.PREFERRED)
                        .map(JobSkillResponse::from).toList(),
                analysis == null ? null : new AnalysisState(analysis.getStatus().name()));
    }
}
