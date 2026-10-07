package com.devjob.job.entity;

import com.devjob.job.model.NormalizedJobPosting;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "job_posting", uniqueConstraints = @UniqueConstraint(
        name = "uk_job_posting_source_external", columnNames = {"job_source_id", "external_id"}))
public class JobPosting {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_source_id", nullable = false)
    private JobSource jobSource;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;
    @Column(name = "external_id", nullable = false, columnDefinition = "text")
    private String externalId;
    @Column(name = "title", nullable = false, columnDefinition = "text")
    private String title;
    @Column(name = "description", columnDefinition = "text")
    private String description;
    @Column(name = "employment_type", columnDefinition = "text")
    private String employmentType;
    @Column(name = "career_requirement", columnDefinition = "text")
    private String careerRequirement;
    @Column(name = "location", columnDefinition = "text")
    private String location;
    @Column(name = "posted_date")
    private LocalDate postedDate;
    @Column(name = "deadline_date")
    private LocalDate deadlineDate;
    @Column(name = "source_url", nullable = false, columnDefinition = "text")
    private String sourceUrl;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected JobPosting() { }

    public JobPosting(JobSource source, Company company, NormalizedJobPosting input) {
        this.jobSource = source;
        this.company = company;
        this.externalId = input.externalId();
        this.title = input.title();
        this.description = input.description();
        this.employmentType = input.employmentType();
        this.careerRequirement = input.careerRequirement();
        this.location = input.location();
        this.postedDate = input.postedDate();
        this.deadlineDate = input.deadlineDate();
        this.sourceUrl = input.sourceUrl();
    }

    public void update(Company updatedCompany, NormalizedJobPosting input, boolean hasDetail) {
        company = updatedCompany;
        title = input.title();
        if (hasDetail) description = input.description();
        employmentType = input.employmentType();
        careerRequirement = input.careerRequirement();
        location = input.location();
        postedDate = input.postedDate();
        deadlineDate = input.deadlineDate();
        sourceUrl = input.sourceUrl();
        updatedAt = Instant.now();
    }

    @PrePersist
    private void initializeTimestamps() {
        createdAt = updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public JobSource getJobSource() { return jobSource; }
    public Company getCompany() { return company; }
    public String getExternalId() { return externalId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getEmploymentType() { return employmentType; }
    public String getCareerRequirement() { return careerRequirement; }
    public String getLocation() { return location; }
    public LocalDate getPostedDate() { return postedDate; }
    public LocalDate getDeadlineDate() { return deadlineDate; }
    public String getSourceUrl() { return sourceUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
