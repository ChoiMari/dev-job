package com.devjob.learninggoal.dto;

import com.devjob.learninggoal.entity.LearningGoal;
import com.devjob.skill.dto.SkillResponse;
import java.time.Instant;

public record LearningGoalResponse(Long id, String title, String description, SkillResponse skill,
        int progressPercent, boolean completed, Instant completedAt, Instant createdAt, Instant updatedAt) {
    public static LearningGoalResponse from(LearningGoal goal) {
        var skill = goal.getSkill();
        return new LearningGoalResponse(goal.getId(), goal.getTitle(), goal.getDescription(),
                skill == null ? null : new SkillResponse(skill.getId(), skill.getName()),
                goal.getProgressPercent(), goal.getCompletedAt() != null, goal.getCompletedAt(),
                goal.getCreatedAt(), goal.getUpdatedAt());
    }
}
