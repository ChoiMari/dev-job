package com.devjob.project.entity;

import com.devjob.project.dto.ProjectInput;
import com.devjob.skill.entity.Skill;
import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "project")
public class Project {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(nullable = false, length = 100) private String name;
    @Enumerated(EnumType.STRING) @Column(name = "project_type", nullable = false, length = 16)
    private ProjectType projectType = ProjectType.UNSPECIFIED;
    @Column(length = 2000) private String description;
    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "end_date") private LocalDate endDate;
    @Column(length = 100) private String role;
    @Column(name = "key_features", length = 2000) private String keyFeatures;
    @Column(length = 2000) private String outcome;
    @Column(name = "project_url", length = 2000) private String projectUrl;
    @Column(length = 200) private String summary;
    @Column(length = 100) private String category;
    @Column(name = "team_size") private Integer teamSize;
    @Column(name = "problem_solving", length = 1000) private String problemSolving;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "feature_items", columnDefinition = "jsonb", nullable = false)
    private List<String> featureItems = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "achievement_items", columnDefinition = "jsonb", nullable = false)
    private List<String> achievementItems = new ArrayList<>();
    @Column(name = "demo_url", length = 2000) private String demoUrl;
    @Column(name = "github_url", length = 2000) private String githubUrl;
    @Column(name = "presentation_url", length = 2000) private String presentationUrl;
    @Column(name = "contribution_percent") private Integer contributionPercent;
    @Column(length = 1000) private String responsibilities;
    @Column(length = 1000) private String troubleshooting;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "metric_items", columnDefinition = "jsonb", nullable = false)
    private List<String> metricItems = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "contribution_items", columnDefinition = "jsonb", nullable = false)
    private List<ProjectInput.ContributionItem> contributionItems = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "troubleshooting_items", columnDefinition = "jsonb", nullable = false)
    private List<String> troubleshootingItems = new ArrayList<>();
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectSkill> skills = new ArrayList<>();
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectCustomSkill> customSkills = new ArrayList<>();

    protected Project() { }
    public Project(User user) { this.user = user; this.createdAt = Instant.now(); }
    public void update(ProjectInput input, List<Skill> selected, List<ProjectInput.CustomSkillItem> custom) {
        name = input.name(); projectType = input.projectType(); description = input.description(); startDate = input.startDate(); endDate = input.endDate();
        role = input.role(); keyFeatures = input.keyFeatures(); outcome = input.outcome(); projectUrl = input.projectUrl();
        summary = input.summary(); category = input.category(); teamSize = input.teamSize(); problemSolving = input.problemSolving();
        featureItems = new ArrayList<>(input.featureItems().isEmpty() && keyFeatures != null ? List.of(keyFeatures) : input.featureItems());
        achievementItems = new ArrayList<>(input.achievementItems().isEmpty() && outcome != null ? List.of(outcome) : input.achievementItems());
        if (!input.featureItems().isEmpty()) keyFeatures = legacyText(featureItems);
        if (!input.achievementItems().isEmpty()) outcome = legacyText(achievementItems);
        demoUrl = input.demoUrl(); githubUrl = input.githubUrl(); presentationUrl = input.presentationUrl();
        contributionPercent = input.contributionPercent(); responsibilities = input.responsibilities();
        troubleshooting = input.troubleshooting(); metricItems = new ArrayList<>(input.metricItems());
        contributionItems = new ArrayList<>(input.contributionItems());
        troubleshootingItems = new ArrayList<>(input.troubleshootingItems());
        updatedAt = Instant.now();
        // Preserve unchanged links so a flush cannot insert before deleting the same unique key.
        var ids = selected.stream().map(Skill::getId).toList();
        skills.removeIf(link -> !ids.contains(link.getSkill().getId()));
        for (Skill skill : selected) {
            if (skills.stream().noneMatch(link -> link.getSkill().getId().equals(skill.getId()))) skills.add(new ProjectSkill(this, skill));
        }
        Map<Long, String> usageBySkill = new HashMap<>();
        input.skillUsages().forEach(item -> usageBySkill.put(item.skillId(), item.usage()));
        skills.forEach(link -> link.setUsageNote(usageBySkill.get(link.getSkill().getId())));
        var customKeys = custom.stream().map(item -> item.name().toLowerCase(java.util.Locale.ROOT)).toList();
        customSkills.removeIf(item -> !customKeys.contains(item.getNormalizedName()));
        for (var item : custom) {
            String key = item.name().toLowerCase(java.util.Locale.ROOT);
            var existing = customSkills.stream().filter(skill -> skill.getNormalizedName().equals(key)).findFirst();
            var link = existing.orElseGet(() -> {
                var created = new ProjectCustomSkill(this, item.name(), key);
                customSkills.add(created);
                return created;
            });
            link.setName(item.name()); link.setUsageNote(item.usage());
        }
    }
    private static String legacyText(List<String> items) {
        var result = new StringBuilder();
        for (String item : items) {
            if (result.length() + item.length() + (result.isEmpty() ? 0 : 1) > 2000) break;
            if (!result.isEmpty()) result.append('\n');
            result.append(item);
        }
        return result.isEmpty() ? null : result.toString();
    }
    public Long getId() { return id; }
    public Long getUserId() { return user.getId(); }
    public String getName() { return name; }
    public ProjectType getProjectType() { return projectType; }
    public String getDescription() { return description; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public String getRole() { return role; }
    public String getKeyFeatures() { return keyFeatures; }
    public String getOutcome() { return outcome; }
    public String getProjectUrl() { return projectUrl; }
    public String getSummary() { return summary; }
    public String getCategory() { return category; }
    public Integer getTeamSize() { return teamSize; }
    public String getProblemSolving() { return problemSolving; }
    public List<String> getFeatureItems() { return featureItems; }
    public List<String> getAchievementItems() { return achievementItems; }
    public String getDemoUrl() { return demoUrl; }
    public String getGithubUrl() { return githubUrl; }
    public String getPresentationUrl() { return presentationUrl; }
    public Integer getContributionPercent() { return contributionPercent; }
    public String getResponsibilities() { return responsibilities; }
    public String getTroubleshooting() { return troubleshooting; }
    public List<String> getMetricItems() { return metricItems; }
    public List<ProjectInput.ContributionItem> getContributionItems() { return contributionItems; }
    public List<String> getTroubleshootingItems() { return troubleshootingItems; }
    public List<ProjectSkill> getSkills() { return skills; }
    public List<ProjectCustomSkill> getCustomSkills() { return customSkills; }
}
