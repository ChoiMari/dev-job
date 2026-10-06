package com.devjob.application.entity;

import com.devjob.job.entity.JobPosting;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "application", uniqueConstraints = @UniqueConstraint(name = "uk_application_user_job",
        columnNames = {"user_id", "job_posting_id"}))
public class Application {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_posting_id", nullable = false) private JobPosting job;
    @Enumerated(EnumType.STRING) @Column(name = "current_status", nullable = false, length = 30)
    private ApplicationStatus currentStatus;
    @Column(name = "applied_date") private LocalDate appliedDate;
    @Column(name = "next_schedule_at") private Instant nextScheduleAt;
    @Column(length = 2000) private String note;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected Application() { }
    public Application(User user, JobPosting job, ApplicationStatus status, LocalDate appliedDate,
            String note, Instant nextScheduleAt) {
        this.user = user; this.job = job; this.currentStatus = status; this.appliedDate = appliedDate;
        this.note = note; this.nextScheduleAt = nextScheduleAt;
        this.createdAt = this.updatedAt = Instant.now();
    }
    public void update(boolean noteProvided, String note, boolean scheduleProvided, Instant schedule) {
        if (noteProvided) this.note = note;
        if (scheduleProvided) this.nextScheduleAt = schedule;
        updatedAt = Instant.now();
    }
    public void transition(ApplicationStatus next, LocalDate appliedDate, Instant changedAt) {
        currentStatus = next;
        if (next == ApplicationStatus.APPLIED) this.appliedDate = appliedDate;
        updatedAt = changedAt;
    }
    public Long getId() { return id; }
    public User getUser() { return user; }
    public JobPosting getJob() { return job; }
    public ApplicationStatus getCurrentStatus() { return currentStatus; }
    public LocalDate getAppliedDate() { return appliedDate; }
    public String getNote() { return note; }
    public Instant getNextScheduleAt() { return nextScheduleAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
