package com.devjob.job.model;

import java.time.LocalDate;

public record NormalizedJobPosting(
        String externalId, String companyName, String title, String description,
        String employmentType, String careerRequirement, String location,
        LocalDate postedDate, LocalDate deadlineDate, String sourceUrl) {
}
