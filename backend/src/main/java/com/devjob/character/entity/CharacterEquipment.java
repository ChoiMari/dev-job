package com.devjob.character.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "character_equipment")
public class CharacterEquipment {
    @Id @Column(name = "user_id")
    private Long userId;
    @Column(name = "outfit_item_id", nullable = false, length = 40)
    private String outfitItemId;
    @Column(name = "hair_item_id", nullable = false, length = 40)
    private String hairItemId;
    @Column(name = "glasses_item_id", nullable = false, length = 40)
    private String glassesItemId;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CharacterEquipment() { }
    public CharacterEquipment(Long userId, String outfitItemId) {
        this.userId = userId;
        this.outfitItemId = outfitItemId;
        this.hairItemId = "CLASSIC";
        this.glassesItemId = "NONE";
        this.updatedAt = Instant.now();
    }
    public void equip(String slot, String itemId) {
        String current = switch (slot) {
            case "OUTFIT" -> outfitItemId;
            case "HAIR" -> hairItemId;
            case "GLASSES" -> glassesItemId;
            default -> throw new IllegalArgumentException("Unknown character slot");
        };
        if (!itemId.equals(current)) {
            switch (slot) {
                case "OUTFIT" -> outfitItemId = itemId;
                case "HAIR" -> hairItemId = itemId;
                case "GLASSES" -> glassesItemId = itemId;
                default -> throw new IllegalArgumentException("Unknown character slot");
            }
            updatedAt = Instant.now();
        }
    }
    public String getOutfitItemId() { return outfitItemId; }
    public String getHairItemId() { return hairItemId; }
    public String getGlassesItemId() { return glassesItemId; }
}
