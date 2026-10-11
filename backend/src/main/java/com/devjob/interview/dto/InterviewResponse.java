package com.devjob.interview.dto;

import com.devjob.interview.entity.InterviewSchedule;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public record InterviewResponse(Long id, Long applicationId, String title, OffsetDateTime startsAt,
        String stage, String interviewMethod, String memo,
        String timeZone, String status, Instant cancelledAt, Instant completedAt, Instant createdAt, Instant updatedAt) {
    public static InterviewResponse from(InterviewSchedule interview) {
        return new InterviewResponse(interview.getId(), interview.getApplicationId(), interview.getTitle(),
                interview.getStartsAt().atZone(ZoneId.of(interview.getTimeZone())).toOffsetDateTime(),
                interview.getStage(), interview.getInterviewMethod(), interview.getMemo(),
                interview.getTimeZone(), interview.getCancelledAt() != null ? "CANCELLED"
                        : interview.getCompletedAt() != null ? "COMPLETED" : "SCHEDULED",
                interview.getCancelledAt(), interview.getCompletedAt(), interview.getCreatedAt(), interview.getUpdatedAt());
    }
}
