package com.devjob.application.entity;

import com.devjob.job.entity.JobPosting;
import com.devjob.savedjob.entity.PersonalSavedJob;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "application")
public class Application {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private User user;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_posting_id") private JobPosting job;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "personal_saved_job_id") private PersonalSavedJob personalSavedJob;
    @Enumerated(EnumType.STRING) @Column(name = "current_status", nullable = false, length = 30)
    private ApplicationStatus currentStatus;
    @Column(name = "applied_date") private LocalDate appliedDate;
    @Column(name = "next_schedule_at") private Instant nextScheduleAt;
    @Column(length = 2000) private String note;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;

    protected Application() { }
    public Application(User user, JobPosting job, ApplicationStatus status, LocalDate appliedDate,
            String note, Instant nextScheduleAt) {
        this.user = user; this.job = job; this.currentStatus = status; this.appliedDate = appliedDate;
        this.note = note; this.nextScheduleAt = nextScheduleAt;
        this.createdAt = this.updatedAt = Instant.now();
    }
    public Application(User user, PersonalSavedJob personalSavedJob, ApplicationStatus status, LocalDate appliedDate,
            String note, Instant nextScheduleAt) {
        this.user = user; this.personalSavedJob = personalSavedJob; this.currentStatus = status;
        this.appliedDate = appliedDate; this.note = note; this.nextScheduleAt = nextScheduleAt;
        this.createdAt = this.updatedAt = Instant.now();
    }
    public void update(boolean noteProvided, String note, boolean scheduleProvided, Instant schedule) {
        if (noteProvided) this.note = note;
        if (scheduleProvided) this.nextScheduleAt = schedule;
        updatedAt = Instant.now();
    }
    public void transition(ApplicationStatus next, LocalDate appliedDate, Instant changedAt) {
        currentStatus = next;
        if (next == ApplicationStatus.PLANNED) this.appliedDate = null;
        else if (appliedDate != null) this.appliedDate = appliedDate;
        updatedAt = changedAt;
    }
    public void delete() { deletedAt = Instant.now(); updatedAt = deletedAt; }
    public Long getId() { return id; }
    public User getUser() { return user; }
    public JobPosting getJob() { return job; }
    public PersonalSavedJob getPersonalSavedJob() { return personalSavedJob; }
    public ApplicationStatus getCurrentStatus() { return currentStatus; }
    public LocalDate getAppliedDate() { return appliedDate; }
    public String getNote() { return note; }
    public Instant getNextScheduleAt() { return nextScheduleAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
}
