package com.devjob.interview.dto;

import com.devjob.interview.entity.InterviewSchedule;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public record InterviewResponse(Long id, Long applicationId, String title, OffsetDateTime startsAt,
        String timeZone, String status, Instant cancelledAt, Instant createdAt, Instant updatedAt) {
    public static InterviewResponse from(InterviewSchedule interview) {
        return new InterviewResponse(interview.getId(), interview.getApplicationId(), interview.getTitle(),
                interview.getStartsAt().atZone(ZoneId.of(interview.getTimeZone())).toOffsetDateTime(),
                interview.getTimeZone(), interview.getCancelledAt() == null ? "SCHEDULED" : "CANCELLED",
                interview.getCancelledAt(), interview.getCreatedAt(), interview.getUpdatedAt());
    }
}
