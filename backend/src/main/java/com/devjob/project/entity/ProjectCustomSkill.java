package com.devjob.project.entity;

import jakarta.persistence.*;

@Entity @Table(name = "project_custom_skill", uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "normalized_name"}))
public class ProjectCustomSkill {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false) private Project project;
    @Column(nullable = false, length = 100) private String name;
    @Column(name = "normalized_name", nullable = false, length = 100) private String normalizedName;
    @Column(name = "usage_note", length = 1000) private String usageNote;

    protected ProjectCustomSkill() { }
    public ProjectCustomSkill(Project project, String name, String normalizedName) {
        this.project = project; this.name = name; this.normalizedName = normalizedName;
    }
    public String getName() { return name; }
    public String getNormalizedName() { return normalizedName; }
    public String getUsageNote() { return usageNote; }
    public void setName(String name) { this.name = name; }
    public void setUsageNote(String usageNote) { this.usageNote = usageNote == null || usageNote.isBlank() ? null : usageNote.strip(); }
}
