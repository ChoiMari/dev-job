package com.devjob.interview.entity;

import com.devjob.application.entity.Application;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity @Table(name = "interview_schedule")
public class InterviewSchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "application_id") private Application application;
    @Column(nullable = false, length = 200) private String title;
    @Column(name = "starts_at", nullable = false) private Instant startsAt;
    @Column(name = "time_zone", nullable = false, length = 100) private String timeZone;
    @Column(length = 12) private String stage;
    @Column(name = "interview_method", length = 12) private String interviewMethod;
    @Column(length = 500) private String memo;
    @Column(name = "cancelled_at") private Instant cancelledAt;
    @Column(name = "completed_at") private Instant completedAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected InterviewSchedule() { }
    public InterviewSchedule(User user, Application application, String title, Instant startsAt, String timeZone,
            String stage, String interviewMethod, String memo) {
        this.user = user;
        this.createdAt = this.updatedAt = now();
        update(application, title, startsAt, timeZone, stage, interviewMethod, memo);
    }
    public void update(Application application, String title, Instant startsAt, String timeZone,
            String stage, String interviewMethod, String memo) {
        this.application = application;
        this.title = title;
        this.startsAt = startsAt;
        this.timeZone = timeZone;
        this.stage = stage;
        this.interviewMethod = interviewMethod;
        this.memo = memo;
        this.updatedAt = now();
    }
    public void setCancelled(boolean cancelled) {
        if (cancelled && completedAt != null) throw new IllegalStateException("완료된 면접은 먼저 예정 상태로 되돌려 주세요.");
        if ((cancelledAt != null) != cancelled) {
            this.cancelledAt = cancelled ? now() : null;
            this.updatedAt = now();
        }
    }
    public void setCompleted(boolean completed) {
        if (completed && cancelledAt != null) throw new IllegalStateException("취소된 면접은 먼저 예정 상태로 되돌려 주세요.");
        if ((completedAt != null) != completed) {
            this.completedAt = completed ? now() : null;
            this.updatedAt = now();
        }
    }
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public Long getApplicationId() { return application == null ? null : application.getId(); }
    public Application getApplication() { return application; }
    public String getTitle() { return title; }
    public Instant getStartsAt() { return startsAt; }
    public String getTimeZone() { return timeZone; }
    public String getStage() { return stage; }
    public String getInterviewMethod() { return interviewMethod; }
    public String getMemo() { return memo; }
    public Instant getCancelledAt() { return cancelledAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
