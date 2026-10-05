package com.devjob.skill.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "skill_alias")
public class SkillAlias {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;
    @Column(name = "alias_name", nullable = false, length = 100)
    private String aliasName;
    @Column(name = "normalized_name", nullable = false, unique = true, length = 100)
    private String normalizedName;
    protected SkillAlias() { }
}
