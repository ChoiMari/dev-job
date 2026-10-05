package com.devjob.project.entity;

import com.devjob.project.dto.ProjectInput;
import com.devjob.skill.entity.Skill;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity @Table(name = "project")
public class Project {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(nullable = false, length = 100) private String name;
    @Column(length = 2000) private String description;
    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "end_date") private LocalDate endDate;
    @Column(length = 100) private String role;
    @Column(name = "key_features", length = 2000) private String keyFeatures;
    @Column(length = 2000) private String outcome;
    @Column(name = "project_url", length = 2000) private String projectUrl;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectSkill> skills = new ArrayList<>();

    protected Project() { }
    public Project(User user) { this.user = user; this.createdAt = Instant.now(); }
    public void update(ProjectInput input, List<Skill> selected) {
        name = input.name(); description = input.description(); startDate = input.startDate(); endDate = input.endDate();
        role = input.role(); keyFeatures = input.keyFeatures(); outcome = input.outcome(); projectUrl = input.projectUrl();
        updatedAt = Instant.now();
        // Preserve unchanged links so a flush cannot insert before deleting the same unique key.
        var ids = selected.stream().map(Skill::getId).toList();
        skills.removeIf(link -> !ids.contains(link.getSkill().getId()));
        for (Skill skill : selected) {
            if (skills.stream().noneMatch(link -> link.getSkill().getId().equals(skill.getId()))) skills.add(new ProjectSkill(this, skill));
        }
    }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public String getRole() { return role; }
    public String getKeyFeatures() { return keyFeatures; }
    public String getOutcome() { return outcome; }
    public String getProjectUrl() { return projectUrl; }
    public List<ProjectSkill> getSkills() { return skills; }
}
