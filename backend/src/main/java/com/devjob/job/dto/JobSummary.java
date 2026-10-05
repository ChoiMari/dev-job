package com.devjob.job.dto;

import com.devjob.job.entity.JobPosting;
import java.time.LocalDate;

public record JobSummary(Long id, String title, CompanyView company, String source, String location,
        String careerRequirement, String employmentType, LocalDate deadlineDate,
        Integer matchRate, boolean bookmarked, String applicationStatus) {
    public record CompanyView(Long id, String name) { }
    public static JobSummary from(JobPosting job) {
        return new JobSummary(job.getId(), job.getTitle(), new CompanyView(job.getCompany().getId(),
                job.getCompany().getName()), job.getJobSource().getCode(), job.getLocation(),
                job.getCareerRequirement(), job.getEmploymentType(), job.getDeadlineDate(), null, false, null);
    }
}
