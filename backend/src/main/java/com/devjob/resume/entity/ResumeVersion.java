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
    @Column(name = "version_title", length = 50) private String title;
    @Column(name = "version_description", length = 200) private String description;
    @Column(name = "form_ciphertext", columnDefinition = "bytea") private byte[] formCiphertext;
    @Column(name = "form_nonce", columnDefinition = "bytea") private byte[] formNonce;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected ResumeVersion() { }
    public ResumeVersion(Resume resume, int versionNumber, byte[] contentCiphertext, byte[] contentNonce) {
        this(resume, versionNumber, contentCiphertext, contentNonce, null, null);
    }
    public ResumeVersion(Resume resume, int versionNumber, byte[] contentCiphertext, byte[] contentNonce, String title, String description) {
        this.resume = resume;
        this.versionNumber = versionNumber;
        this.contentCiphertext = contentCiphertext.clone();
        this.contentNonce = contentNonce.clone();
        this.title = title;
        this.description = description;
        this.createdAt = Resume.now();
    }
    public Long getId() { return id; }
    public Long getResumeId() { return resume.getId(); }
    public int getVersionNumber() { return versionNumber; }
    public byte[] getContentCiphertext() { return contentCiphertext.clone(); }
    public byte[] getContentNonce() { return contentNonce.clone(); }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public byte[] getFormCiphertext() { return formCiphertext == null ? null : formCiphertext.clone(); }
    public byte[] getFormNonce() { return formNonce == null ? null : formNonce.clone(); }
    public void replace(String title, String description, byte[] ciphertext, byte[] nonce, byte[] formCiphertext, byte[] formNonce) {
        this.title = title;
        this.description = description;
        this.contentCiphertext = ciphertext.clone();
        this.contentNonce = nonce.clone();
        this.formCiphertext = formCiphertext == null ? null : formCiphertext.clone();
        this.formNonce = formNonce == null ? null : formNonce.clone();
    }
    public void setForm(byte[] ciphertext, byte[] nonce) {
        this.formCiphertext = ciphertext.clone();
        this.formNonce = nonce.clone();
    }
    public Instant getCreatedAt() { return createdAt; }
}
