package com.devjob.job.dto;

import com.devjob.job.entity.JobPosting;
import java.time.LocalDate;

public record JobSummary(Long id, String title, CompanyView company, String source, String location,
        String careerRequirement, String employmentType, LocalDate deadlineDate,
        Integer matchRate, boolean bookmarked, String applicationStatus) {
    public record CompanyView(Long id, String name) { }
    public static JobSummary from(JobPosting job) {
        return from(job, false, null);
    }
    public static JobSummary from(JobPosting job, boolean bookmarked) {
        return from(job, bookmarked, null);
    }
    public static JobSummary from(JobPosting job, String applicationStatus) {
        return from(job, false, applicationStatus);
    }
    public static JobSummary from(JobPosting job, boolean bookmarked, String applicationStatus) {
        return from(job, bookmarked, applicationStatus, null);
    }
    public static JobSummary from(JobPosting job, boolean bookmarked, String applicationStatus, Integer matchRate) {
        return new JobSummary(job.getId(), job.getTitle(), new CompanyView(job.getCompany().getId(),
                job.getCompany().getName()), job.getJobSource().getCode(), job.getLocation(),
                job.getCareerRequirement(), job.getEmploymentType(), job.getDeadlineDate(), matchRate, bookmarked, applicationStatus);
    }
}
