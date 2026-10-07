package com.devjob.application.dto;

import com.devjob.application.entity.*;
import com.devjob.job.dto.JobSummary;
import com.devjob.savedjob.dto.PersonalSavedJobResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ApplicationResponse(Long id, JobSummary job, PersonalSavedJobResponse personalSavedJob, ApplicationStatus currentStatus,
        LocalDate appliedDate, Instant nextScheduleAt, String note, Instant createdAt, Instant updatedAt) {
    public static ApplicationResponse from(Application application) {
        return new ApplicationResponse(application.getId(), application.getJob() == null ? null :
                JobSummary.from(application.getJob(), application.getCurrentStatus().name()),
                application.getPersonalSavedJob() == null ? null : PersonalSavedJobResponse.from(application.getPersonalSavedJob()),
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
