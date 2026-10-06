package com.devjob.application.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "application_status_history")
public class ApplicationStatusHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false) private Application application;
    @Enumerated(EnumType.STRING) @Column(name = "from_status", length = 30) private ApplicationStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name = "to_status", nullable = false, length = 30) private ApplicationStatus toStatus;
    @Column(name = "changed_at", nullable = false) private Instant changedAt;
    protected ApplicationStatusHistory() { }
    public ApplicationStatusHistory(Application application, ApplicationStatus from, ApplicationStatus to, Instant at) {
        this.application = application; this.fromStatus = from; this.toStatus = to; this.changedAt = at;
    }
    public Long getId() { return id; }
    public ApplicationStatus getFromStatus() { return fromStatus; }
    public ApplicationStatus getToStatus() { return toStatus; }
    public Instant getChangedAt() { return changedAt; }
}
