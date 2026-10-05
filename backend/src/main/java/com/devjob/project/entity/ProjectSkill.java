package com.devjob.project.entity;

import com.devjob.skill.entity.Skill;
import jakarta.persistence.*;

@Entity @Table(name = "project_skill", uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "skill_id"}))
public class ProjectSkill {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false) private Project project;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_id", nullable = false) private Skill skill;
    protected ProjectSkill() { }
    public ProjectSkill(Project project, Skill skill) { this.project = project; this.skill = skill; }
    public Long getProjectId() { return project.getId(); }
    public Skill getSkill() { return skill; }
}
