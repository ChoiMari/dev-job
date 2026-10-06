package com.devjob.application.dto;

import com.devjob.application.entity.*;
import com.devjob.job.dto.JobSummary;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ApplicationResponse(Long id, JobSummary job, ApplicationStatus currentStatus,
        LocalDate appliedDate, Instant nextScheduleAt, String note, Instant createdAt, Instant updatedAt) {
    public static ApplicationResponse from(Application application) {
        return new ApplicationResponse(application.getId(), JobSummary.from(application.getJob(), application.getCurrentStatus().name()),
                application.getCurrentStatus(), application.getAppliedDate(), application.getNextScheduleAt(),
                application.getNote(), application.getCreatedAt(), application.getUpdatedAt());
    }
    public record Page(List<ApplicationResponse> items, int page, int size, long totalElements) { }
    public record History(Long id, ApplicationStatus fromStatus, ApplicationStatus toStatus, Instant changedAt) {
        public static History from(ApplicationStatusHistory history) {
            return new History(history.getId(), history.getFromStatus(), history.getToStatus(), history.getChangedAt());
        }
    }
}
