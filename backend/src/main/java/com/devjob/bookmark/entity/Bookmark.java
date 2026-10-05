package com.devjob.bookmark.entity;

import com.devjob.job.entity.JobPosting;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "bookmark", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "job_posting_id"}))
public class Bookmark {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_posting_id", nullable = false)
    private JobPosting job;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    protected Bookmark() { }
    public Long getId() { return id; }
    public JobPosting getJob() { return job; }
    public Instant getCreatedAt() { return createdAt; }
}
