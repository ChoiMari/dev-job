package com.devjob.todo.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity @Table(name = "personal_todo")
public class PersonalTodo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(nullable = false, length = 200) private String title;
    @Column(length = 2000) private String description;
    @Column(nullable = false, length = 30) private String category = "기타";
    @Column(name = "reminder_minutes", nullable = false) private int reminderMinutes = 1440;
    @Column(name = "due_at") private Instant dueAt;
    @Column(name = "due_time_zone", length = 100) private String dueTimeZone;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Column(name = "reward_eligible", nullable = false) private boolean rewardEligible = true;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected PersonalTodo() { }
    public PersonalTodo(User user, String title, String description, Instant dueAt, String dueTimeZone) {
        this(user, title, description, dueAt, dueTimeZone, "기타", 1440);
    }
    public PersonalTodo(User user, String title, String description, Instant dueAt, String dueTimeZone,
            String category, int reminderMinutes) {
        this.user = user;
        this.createdAt = this.updatedAt = now();
        update(title, description, dueAt, dueTimeZone, category, reminderMinutes);
    }
    public void update(String title, String description, Instant dueAt, String dueTimeZone) {
        update(title, description, dueAt, dueTimeZone, category, reminderMinutes);
    }
    public void update(String title, String description, Instant dueAt, String dueTimeZone,
            String category, int reminderMinutes) {
        this.title = title; this.description = description; this.dueAt = dueAt; this.dueTimeZone = dueTimeZone;
        this.category = category; this.reminderMinutes = reminderMinutes;
        this.updatedAt = now();
    }
    public void setCompleted(boolean completed) {
        if (completed != (completedAt != null)) {
            completedAt = completed ? now() : null;
            updatedAt = now();
        }
    }
    public void delete() { deletedAt = now(); updatedAt = deletedAt; }
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getCategory() { return category; }
    public int getReminderMinutes() { return reminderMinutes; }
    public Instant getDueAt() { return dueAt; }
    public String getDueTimeZone() { return dueTimeZone; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public boolean isRewardEligible() { return rewardEligible; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
