package com.devjob.documentanalysis.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity @Table(name = "document_analysis")
public class DocumentAnalysis {
    public enum Status { PENDING, COMPLETED, FAILED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "resume_version_id", unique = true) private Long resumeVersionId;
    @Column(name = "cover_letter_version_id", unique = true) private Long coverLetterVersionId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
    @Column(name = "result_ciphertext", columnDefinition = "bytea") private byte[] resultCiphertext;
    @Column(name = "result_nonce", columnDefinition = "bytea") private byte[] resultNonce;
    @Column(name = "failure_reason", length = 200) private String failureReason;
    @Column(name = "consented_at", nullable = false) private Instant consentedAt;
    @Column(name = "analyzed_at") private Instant analyzedAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected DocumentAnalysis() { }
    public DocumentAnalysis(Long resumeVersionId, Long coverLetterVersionId) {
        this.resumeVersionId = resumeVersionId; this.coverLetterVersionId = coverLetterVersionId; pending();
    }
    public void pending() {
        status = Status.PENDING; resultCiphertext = null; resultNonce = null; failureReason = null; analyzedAt = null;
        consentedAt = updatedAt = now();
    }
    public void completed(byte[] ciphertext, byte[] nonce) {
        status = Status.COMPLETED; resultCiphertext = ciphertext.clone(); resultNonce = nonce.clone(); failureReason = null;
        analyzedAt = updatedAt = now();
    }
    public void failed() {
        status = Status.FAILED; resultCiphertext = null; resultNonce = null;
        failureReason = "분석을 완료하지 못했습니다. 다시 시도해 주세요.";
        analyzedAt = null; updatedAt = now();
    }
    private static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
    public Long getId() { return id; }
    public Long getResumeVersionId() { return resumeVersionId; }
    public Long getCoverLetterVersionId() { return coverLetterVersionId; }
    public Status getStatus() { return status; }
    public byte[] getResultCiphertext() { return resultCiphertext == null ? null : resultCiphertext.clone(); }
    public byte[] getResultNonce() { return resultNonce == null ? null : resultNonce.clone(); }
    public String getFailureReason() { return failureReason; }
    public Instant getConsentedAt() { return consentedAt; }
    public Instant getAnalyzedAt() { return analyzedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
