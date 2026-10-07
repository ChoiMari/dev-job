package com.devjob.savedjob.dto;

import com.devjob.savedjob.entity.PersonalSavedJob;
import java.time.Instant;
import java.time.LocalDate;

public record PersonalSavedJobResponse(Long id, String url, String companyName, String title, String role,
        String careerLevel, String location, String employmentType, LocalDate deadlineDate, String note, String description,
        Instant createdAt, Instant updatedAt) {
    public static PersonalSavedJobResponse from(PersonalSavedJob job) {
        return new PersonalSavedJobResponse(job.getId(), job.getUrl(), job.getCompanyName(), job.getTitle(),
                job.getRole(), job.getCareerLevel(), job.getLocation(), job.getEmploymentType(),
                job.getDeadlineDate(), job.getNote(), job.getDescription(), job.getCreatedAt(), job.getUpdatedAt());
    }
}
