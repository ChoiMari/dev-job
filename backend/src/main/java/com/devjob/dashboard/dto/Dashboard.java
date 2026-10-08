package com.devjob.dashboard.dto;

import com.devjob.application.entity.ApplicationStatus;
import com.devjob.job.dto.JobSummary;
import com.devjob.skill.dto.SkillResponse;
import com.devjob.todo.dto.TodoResponse;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record Dashboard(Map<ApplicationStatus, Long> applicationCounts, long bookmarkCount,
        List<NextAction> nextActions, List<JobSummary> recommendedJobs, List<SkillResponse> skillGapPreview,
        List<TodoResponse> personalTodos) {
    public record NextAction(Long applicationId, Long jobId, String jobTitle,
            ApplicationStatus status, Instant nextScheduleAt) { }
}
