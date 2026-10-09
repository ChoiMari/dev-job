package com.devjob.coverletter.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity @Table(name = "cover_letter")
public class CoverLetter {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(nullable = false, length = 200) private String title;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;

    protected CoverLetter() { }
    public CoverLetter(User user, String title) {
        this.user = user;
        this.title = title;
        this.createdAt = this.updatedAt = now();
    }
    public void rename(String title) { this.title = title; this.updatedAt = now(); }
    public void versionAdded() { this.updatedAt = now(); }
    public void delete() { this.deletedAt = now(); this.updatedAt = deletedAt; }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getTitle() { return title; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public static Instant now() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }
}
