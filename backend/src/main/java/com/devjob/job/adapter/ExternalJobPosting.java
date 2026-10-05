package com.devjob.job.adapter;

/** Untrusted provider values. Dates use ISO date text; validation happens per posting. */
public record ExternalJobPosting(
        String externalId, String companyName, String title, String description,
        String employmentType, String careerRequirement, String location,
        String postedDate, String deadlineDate, String sourceUrl) {
}
