package com.devjob.analysis.entity;

import com.devjob.job.entity.JobPosting;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "ai_analysis")
public class AIAnalysis {
    public enum Status { PENDING, COMPLETED, FAILED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_posting_id", nullable = false, unique = true)
    private JobPosting job;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "jsonb")
    private String resultJson;
    @Column(name = "failure_reason", length = 200)
    private String failureReason;
    @Column(name = "analyzed_at")
    private Instant analyzedAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    protected AIAnalysis() { }
    public AIAnalysis(JobPosting job) { this.job = job; pending(); }
    public void pending() { status = Status.PENDING; resultJson = null; failureReason = null; analyzedAt = null; updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS); }
    public void completed(String json) { status = Status.COMPLETED; resultJson = json; failureReason = null; analyzedAt = updatedAt = Instant.now(); }
    public void failed() { status = Status.FAILED; resultJson = null; failureReason = "분석을 완료하지 못했습니다. 다시 시도해 주세요."; analyzedAt = null; updatedAt = Instant.now(); }
    public Status getStatus() { return status; }
    public Instant getAnalyzedAt() { return analyzedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getFailureReason() { return failureReason; }
}
