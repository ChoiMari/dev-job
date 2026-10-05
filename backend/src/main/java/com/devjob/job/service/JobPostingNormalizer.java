package com.devjob.job.service;

import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.model.NormalizedJobPosting;
import java.net.URI;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

@Component
public class JobPostingNormalizer {
    public NormalizedJobPosting normalize(ExternalJobPosting input) {
        if (input == null) {
            throw new IllegalArgumentException("Posting is required");
        }
        String externalId = required(input.externalId());
        String companyName = required(input.companyName());
        String title = required(input.title());
        String sourceUrl = required(input.sourceUrl());
        URI uri = URI.create(sourceUrl);
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Invalid source URL");
        }
        LocalDate postedDate = date(input.postedDate());
        LocalDate deadlineDate = date(input.deadlineDate());
        if (postedDate != null && deadlineDate != null && deadlineDate.isBefore(postedDate)) {
            throw new IllegalArgumentException("Deadline precedes posting date");
        }
        return new NormalizedJobPosting(externalId, companyName, title, optional(input.description()),
                optional(input.employmentType()), optional(input.careerRequirement()), optional(input.location()),
                postedDate, deadlineDate, sourceUrl);
    }

    private String required(String value) {
        String normalized = optional(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Required posting field is missing");
        }
        return normalized;
    }

    private String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private LocalDate date(String value) {
        String normalized = optional(value);
        return normalized == null ? null : LocalDate.parse(normalized);
    }
}
