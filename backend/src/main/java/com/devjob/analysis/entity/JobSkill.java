package com.devjob.analysis.entity;

import com.devjob.job.entity.JobPosting;
import com.devjob.skill.entity.Skill;
import jakarta.persistence.*;

@Entity
@Table(name = "job_skill", uniqueConstraints = @UniqueConstraint(name = "uq_job_skill", columnNames = {"job_posting_id", "skill_id"}))
public class JobSkill {
    public enum RequirementType { REQUIRED, PREFERRED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_posting_id", nullable = false)
    private JobPosting job;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;
    @Enumerated(EnumType.STRING)
    @Column(name = "requirement_type", nullable = false, length = 20)
    private RequirementType requirementType;
    protected JobSkill() { }
    public JobSkill(JobPosting job, Skill skill, RequirementType type) { this.job = job; this.skill = skill; this.requirementType = type; }
    public Skill getSkill() { return skill; }
    public RequirementType getRequirementType() { return requirementType; }
}
