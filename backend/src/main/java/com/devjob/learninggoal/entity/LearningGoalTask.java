package com.devjob.learninggoal.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity @Table(name = "learning_goal_task")
public class LearningGoalTask {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "goal_id", nullable = false)
    private LearningGoal goal;
    @Column(nullable = false, length = 200) private String title;
    @Column(nullable = false) private boolean completed;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected LearningGoalTask() { }
    public LearningGoalTask(LearningGoal goal, String title) {
        this.goal = goal;
        this.title = title;
        this.createdAt = this.updatedAt = now();
    }
    public void update(String title, boolean completed) {
        if (this.title.equals(title) && this.completed == completed) return;
        this.title = title;
        this.completed = completed;
        this.updatedAt = now();
    }
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public Long getGoalId() { return goal.getId(); }
    public String getTitle() { return title; }
    public boolean isCompleted() { return completed; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
