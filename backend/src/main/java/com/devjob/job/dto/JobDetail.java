package com.devjob.job.dto;

import com.devjob.job.entity.JobPosting;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.time.LocalDate;
import java.util.List;

public record JobDetail(@JsonUnwrapped JobSummary summary, String description, LocalDate postedDate,
        String sourceUrl, List<Object> requiredSkills, List<Object> preferredSkills, Object analysis) {
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
        return new JobDetail(JobSummary.from(job, bookmarked, applicationStatus), job.getDescription(), job.getPostedDate(),
                job.getSourceUrl(), List.of(), List.of(), null);
    }
}
