package com.devjob.company.entity;

import com.devjob.company.dto.CompanyInput;
import com.devjob.company.dto.CompanyStatus;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "interested_company")
public class InterestedCompany {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(name = "website_url", length = 2048)
    private String websiteUrl;
    @Column(length = 2000)
    private String note;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CompanyStatus status;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected InterestedCompany() { }
    public InterestedCompany(User user, CompanyInput input, String websiteUrl) {
        this.user = user;
        this.createdAt = Instant.now();
        update(input, websiteUrl);
    }
    public void update(CompanyInput input, String normalizedWebsiteUrl) {
        name = input.name().strip();
        websiteUrl = normalizedWebsiteUrl;
        note = input.note() == null || input.note().isBlank() ? null : input.note().strip();
        status = input.status();
        updatedAt = Instant.now();
    }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getName() { return name; }
    public String getWebsiteUrl() { return websiteUrl; }
    public String getNote() { return note; }
    public CompanyStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
