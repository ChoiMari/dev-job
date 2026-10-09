package com.devjob.character.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "character_reward")
public class CharacterReward {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(name = "quest_id", nullable = false, length = 40) private String questId;
    @Column(name = "item_id", nullable = false, length = 40) private String itemId;
    @Column(name = "claimed_at", nullable = false) private Instant claimedAt;
    protected CharacterReward() { }
    public CharacterReward(User user, String questId, String itemId, Instant claimedAt) {
        this.user = user; this.questId = questId; this.itemId = itemId; this.claimedAt = claimedAt;
    }
    public String getQuestId() { return questId; }
    public String getItemId() { return itemId; }
    public Instant getClaimedAt() { return claimedAt; }
}
