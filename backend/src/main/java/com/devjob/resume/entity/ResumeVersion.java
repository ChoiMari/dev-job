package com.devjob.resume.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "resume_version", uniqueConstraints = @UniqueConstraint(name = "uq_resume_version_number", columnNames = {"resume_id", "version_number"}))
public class ResumeVersion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "resume_id", nullable = false) private Resume resume;
    @Column(name = "version_number", nullable = false) private int versionNumber;
    @Column(name = "content_ciphertext", nullable = false, columnDefinition = "bytea") private byte[] contentCiphertext;
    @Column(name = "content_nonce", nullable = false, columnDefinition = "bytea") private byte[] contentNonce;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected ResumeVersion() { }
    public ResumeVersion(Resume resume, int versionNumber, byte[] contentCiphertext, byte[] contentNonce) {
        this.resume = resume;
        this.versionNumber = versionNumber;
        this.contentCiphertext = contentCiphertext.clone();
        this.contentNonce = contentNonce.clone();
        this.createdAt = Resume.now();
    }
    public Long getId() { return id; }
    public Long getResumeId() { return resume.getId(); }
    public int getVersionNumber() { return versionNumber; }
    public byte[] getContentCiphertext() { return contentCiphertext.clone(); }
    public byte[] getContentNonce() { return contentNonce.clone(); }
    public Instant getCreatedAt() { return createdAt; }
}
