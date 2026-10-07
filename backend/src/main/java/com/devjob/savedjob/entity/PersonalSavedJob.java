package com.devjob.savedjob.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "personal_saved_job")
public class PersonalSavedJob {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(nullable = false, length = 2048) private String url;
    @Column(name = "company_name", nullable = false, length = 200) private String companyName;
    @Column(nullable = false, length = 300) private String title;
    @Column(length = 120) private String role;
    @Column(name = "career_level", length = 120) private String careerLevel;
    @Column(length = 200) private String location;
    @Column(name = "employment_type", length = 120) private String employmentType;
    @Column(name = "deadline_date") private LocalDate deadlineDate;
    @Column(length = 2000) private String note;
    @Column(columnDefinition = "text") private String description;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    protected PersonalSavedJob() { }
    public PersonalSavedJob(User user, String url, String companyName, String title, String role,
            String careerLevel, String location, String employmentType, LocalDate deadlineDate, String note, String description) {
        this.user = user; this.createdAt = this.updatedAt = Instant.now();
        update(url, companyName, title, role, careerLevel, location, employmentType, deadlineDate, note, description);
    }
    public void update(String url, String companyName, String title, String role, String careerLevel,
            String location, String employmentType, LocalDate deadlineDate, String note, String description) {
        this.url = url; this.companyName = companyName; this.title = title; this.role = role;
        this.careerLevel = careerLevel; this.location = location; this.employmentType = employmentType;
        this.deadlineDate = deadlineDate; this.note = note; this.description = description; this.updatedAt = Instant.now();
    }
    public void delete() { this.deletedAt = Instant.now(); this.updatedAt = deletedAt; }
    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getUrl() { return url; }
    public String getCompanyName() { return companyName; }
    public String getTitle() { return title; }
    public String getRole() { return role; }
    public String getCareerLevel() { return careerLevel; }
    public String getLocation() { return location; }
    public String getEmploymentType() { return employmentType; }
    public LocalDate getDeadlineDate() { return deadlineDate; }
    public String getNote() { return note; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getDeletedAt() { return deletedAt; }
}
