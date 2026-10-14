package com.devjob.learninggoal.dto;

import com.devjob.learninggoal.entity.LearningGoalTask;
import java.time.Instant;

public record LearningGoalTaskResponse(Long id, String title, boolean completed, Instant createdAt, Instant updatedAt) {
    public static LearningGoalTaskResponse from(LearningGoalTask task) {
        return new LearningGoalTaskResponse(task.getId(), task.getTitle(), task.isCompleted(),
                task.getCreatedAt(), task.getUpdatedAt());
    }
}
