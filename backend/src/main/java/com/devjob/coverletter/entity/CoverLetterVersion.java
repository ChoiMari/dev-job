package com.devjob.coverletter.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "cover_letter_version", uniqueConstraints = @UniqueConstraint(name = "uq_cover_letter_version_number", columnNames = {"cover_letter_id", "version_number"}))
public class CoverLetterVersion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "cover_letter_id", nullable = false) private CoverLetter coverLetter;
    @Column(name = "version_number", nullable = false) private int versionNumber;
    @Column(name = "content_ciphertext", nullable = false, columnDefinition = "bytea") private byte[] contentCiphertext;
    @Column(name = "content_nonce", nullable = false, columnDefinition = "bytea") private byte[] contentNonce;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected CoverLetterVersion() { }
    public CoverLetterVersion(CoverLetter coverLetter, int versionNumber, byte[] contentCiphertext, byte[] contentNonce) {
        this.coverLetter = coverLetter;
        this.versionNumber = versionNumber;
        this.contentCiphertext = contentCiphertext.clone();
        this.contentNonce = contentNonce.clone();
        this.createdAt = CoverLetter.now();
    }
    public Long getId() { return id; }
    public Long getCoverLetterId() { return coverLetter.getId(); }
    public int getVersionNumber() { return versionNumber; }
    public byte[] getContentCiphertext() { return contentCiphertext.clone(); }
    public byte[] getContentNonce() { return contentNonce.clone(); }
    public Instant getCreatedAt() { return createdAt; }
}
