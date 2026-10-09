package com.devjob.learninggoal.entity;

import com.devjob.skill.entity.Skill;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity @Table(name = "learning_goal")
public class LearningGoal {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "skill_id") private Skill skill;
    @Column(nullable = false, length = 200) private String title;
    @Column(length = 2000) private String description;
    @Column(name = "progress_percent", nullable = false) private int progressPercent;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected LearningGoal() { }
    public LearningGoal(User user, Skill skill, String title, String description, int progressPercent) {
        this.user = user;
        this.skill = skill;
        this.title = title;
        this.description = description;
        this.progressPercent = progressPercent;
        this.createdAt = this.updatedAt = now();
    }
    public void update(Skill skill, String title, String description, int progressPercent) {
        if (completedAt != null && progressPercent < 100) throw new IllegalStateException("Completed goal requires 100% progress");
        if (java.util.Objects.equals(this.skill == null ? null : this.skill.getId(), skill == null ? null : skill.getId())
                && this.title.equals(title) && java.util.Objects.equals(this.description, description)
                && this.progressPercent == progressPercent) return;
        this.skill = skill;
        this.title = title;
        this.description = description;
        this.progressPercent = progressPercent;
        this.updatedAt = now();
    }
    public void setCompleted(boolean completed) {
        if (completed == (completedAt != null)) return;
        if (completed && progressPercent != 100) throw new IllegalStateException("Progress must be 100% before completion");
        completedAt = completed ? now() : null;
        updatedAt = now();
    }
    public void delete() { deletedAt = now(); updatedAt = deletedAt; }
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public Skill getSkill() { return skill; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public int getProgressPercent() { return progressPercent; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
