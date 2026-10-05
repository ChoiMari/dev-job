package com.devjob.job.dto;

import com.devjob.job.entity.JobPosting;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.time.LocalDate;
import java.util.List;

public record JobDetail(@JsonUnwrapped JobSummary summary, String description, LocalDate postedDate,
        String sourceUrl, List<Object> requiredSkills, List<Object> preferredSkills, Object analysis) {
    public static JobDetail from(JobPosting job) {
        return new JobDetail(JobSummary.from(job), job.getDescription(), job.getPostedDate(),
                job.getSourceUrl(), List.of(), List.of(), null);
    }
}
