package com.devjob.skill.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "skill")
public class Skill {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(name = "normalized_name", nullable = false, unique = true, length = 100)
    private String normalizedName;
    @Column(name = "is_system", nullable = false)
    private boolean system;
    protected Skill() { }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getNormalizedName() { return normalizedName; }
    public boolean isSystem() { return system; }
}
