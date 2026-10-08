package com.devjob.company.dto;

import com.devjob.company.entity.InterestedCompany;
import java.time.Instant;

public record CompanyResponse(Long id, String name, String websiteUrl, String note,
        CompanyStatus status, Instant createdAt, Instant updatedAt) {
    public static CompanyResponse from(InterestedCompany company) {
        return new CompanyResponse(company.getId(), company.getName(), company.getWebsiteUrl(),
                company.getNote(), company.getStatus(), company.getCreatedAt(), company.getUpdatedAt());
    }
}
