package com.devjob.company.entity;

import com.devjob.company.dto.CompanyInput;
import com.devjob.company.dto.CompanyStatus;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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
    @Column(length = 80)
    private String industry;
    @Enumerated(EnumType.STRING)
    @Column(name = "company_size", length = 20)
    private com.devjob.company.dto.CompanySize companySize;
    @Column(length = 80)
    private String region;
    @Enumerated(EnumType.STRING)
    @Column(name = "interest_level", nullable = false, length = 20)
    private com.devjob.company.dto.InterestLevel interestLevel;
    @Column(nullable = false)
    private boolean favorite;
    @ElementCollection
    @CollectionTable(name = "interested_company_tag", joinColumns = @JoinColumn(name = "company_id"))
    @OrderColumn(name = "position")
    @Column(name = "tag", nullable = false, length = 30)
    private List<String> tags = new ArrayList<>();
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
        industry = input.industry() == null || input.industry().isBlank() ? null : input.industry().strip();
        companySize = input.companySize();
        region = input.region() == null || input.region().isBlank() ? null : input.region().strip();
        interestLevel = input.interestLevel() == null ? com.devjob.company.dto.InterestLevel.MEDIUM : input.interestLevel();
        favorite = Boolean.TRUE.equals(input.favorite());
        tags.clear();
        if (input.tags() != null) tags.addAll(input.tags());
        updatedAt = Instant.now();
    }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getName() { return name; }
    public String getWebsiteUrl() { return websiteUrl; }
    public String getNote() { return note; }
    public CompanyStatus getStatus() { return status; }
    public String getIndustry() { return industry; }
    public com.devjob.company.dto.CompanySize getCompanySize() { return companySize; }
    public String getRegion() { return region; }
    public com.devjob.company.dto.InterestLevel getInterestLevel() { return interestLevel; }
    public boolean isFavorite() { return favorite; }
    public List<String> getTags() { return tags; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
