package com.devjob.character.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "character_activity", uniqueConstraints = @UniqueConstraint(
        name = "uq_character_activity_once", columnNames = {"user_id", "activity_type", "activity_id"}))
public class CharacterActivity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(name = "activity_type", nullable = false, length = 40) private String activityType;
    @Column(name = "activity_id", nullable = false) private Long activityId;
    @Column(name = "exp_amount", nullable = false) private int expAmount;
    @Column(name = "earned_at", nullable = false) private Instant earnedAt;
    protected CharacterActivity() { }
    public CharacterActivity(User user, String activityType, Long activityId, int expAmount, Instant earnedAt) {
        this.user = user; this.activityType = activityType; this.activityId = activityId;
        this.expAmount = expAmount; this.earnedAt = earnedAt;
    }
    public Long getId() { return id; }
    public String getActivityType() { return activityType; }
    public Long getActivityId() { return activityId; }
    public int getExpAmount() { return expAmount; }
    public Instant getEarnedAt() { return earnedAt; }
}
