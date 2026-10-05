package com.devjob.skill.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_skill", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "skill_id"}))
public class UserSkill {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    protected UserSkill() { }
}
