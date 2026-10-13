package com.devjob.company.dto;

import com.devjob.company.entity.InterestedCompany;
import java.time.Instant;
import java.util.List;

public record CompanyResponse(Long id, String name, String websiteUrl, String note,
        CompanyStatus status, String industry, CompanySize companySize, String region,
        InterestLevel interestLevel, boolean favorite, List<String> tags, Instant createdAt, Instant updatedAt) {
    public static CompanyResponse from(InterestedCompany company) {
        return new CompanyResponse(company.getId(), company.getName(), company.getWebsiteUrl(),
                company.getNote(), company.getStatus(), company.getIndustry(), company.getCompanySize(),
                company.getRegion(), company.getInterestLevel(), company.isFavorite(),
                List.copyOf(company.getTags()), company.getCreatedAt(), company.getUpdatedAt());
    }
}
