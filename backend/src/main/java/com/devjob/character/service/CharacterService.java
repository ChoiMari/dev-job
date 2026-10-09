package com.devjob.character.service;

import com.devjob.character.dto.*;
import com.devjob.character.entity.CharacterEquipment;
import com.devjob.character.repository.CharacterEquipmentRepository;
import com.devjob.character.repository.CharacterRewardRepository;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CharacterService {
    public static final String OUTFIT = "OUTFIT";
    public static final String HAIR = "HAIR";
    public static final String GLASSES = "GLASSES";
    private static final String BODY = "B09-LAYER-BODY";
    private static final List<String> COMPLETE_OUTFITS = List.of("BUNNY", "BEAR", "HOMEBODY", "INTERVIEW", "RAINCOAT", "ASTRONAUT");
    private static final List<CharacterItem> ITEMS = List.of(
            new CharacterItem("BASE", OUTFIT, "기본 의상", "EXT-IMG-06G", "EXT-IMG-06A",
                    List.of("B09-LAYER-OUTFIT-BASE"), true, "ALWAYS"),
            new CharacterItem("MINT", OUTFIT, "민트 후드", "EXT-IMG-06E", "EXT-IMG-06C",
                    List.of("B09-LAYER-OUTFIT-MINT"), true, "ALWAYS"),
            new CharacterItem("PEACH", OUTFIT, "복숭아 재킷", "EXT-IMG-06F", "EXT-IMG-06D",
                    List.of("B09-LAYER-OUTFIT-PEACH"), false, "FUTURE_REWARD"),
            new CharacterItem("BUNNY", OUTFIT, "토끼탈", "B09-THUMB-OUTFIT-BUNNY", "B09-COMPLETE-BUNNY",
                    List.of("B09-COMPLETE-BUNNY"), true, "ALWAYS"),
            new CharacterItem("BEAR", OUTFIT, "곰인형탈", "B09-THUMB-OUTFIT-BEAR", "B09-COMPLETE-BEAR",
                    List.of("B09-COMPLETE-BEAR"), false, "FUTURE_REWARD"),
            new CharacterItem("HOMEBODY", OUTFIT, "집콕 세트", "B09-THUMB-OUTFIT-HOMEBODY", "B09-COMPLETE-HOMEBODY",
                    List.of("B09-COMPLETE-HOMEBODY"), false, "FUTURE_REWARD"),
            new CharacterItem("INTERVIEW", OUTFIT, "면접 정장", "B09-THUMB-OUTFIT-INTERVIEW", "B09-COMPLETE-INTERVIEW",
                    List.of("B09-COMPLETE-INTERVIEW"), false, "FUTURE_REWARD"),
            new CharacterItem("RAINCOAT", OUTFIT, "비 오는 날", "B09-THUMB-OUTFIT-RAINCOAT", "B09-COMPLETE-RAINCOAT",
                    List.of("B09-COMPLETE-RAINCOAT"), false, "FUTURE_REWARD"),
            new CharacterItem("ASTRONAUT", OUTFIT, "우주 탐험", "B09-THUMB-OUTFIT-ASTRONAUT", "B09-COMPLETE-ASTRONAUT",
                    List.of("B09-COMPLETE-ASTRONAUT"), false, "FUTURE_REWARD"),
            new CharacterItem("CLASSIC", HAIR, "기본 머리", "B09-THUMB-HAIR-CLASSIC", "B09-LAYER-HAIR-CLASSIC-FRONT",
                    List.of("B09-LAYER-HAIR-CLASSIC-BACK", "B09-LAYER-HAIR-CLASSIC-FRONT"), true, "ALWAYS"),
            new CharacterItem("BOB", HAIR, "단발 머리", "B09-THUMB-HAIR-BOB", "B09-LAYER-HAIR-BOB-FRONT",
                    List.of("B09-LAYER-HAIR-BOB-BACK", "B09-LAYER-HAIR-BOB-FRONT"), true, "ALWAYS"),
            new CharacterItem("PONY", HAIR, "묶은 머리", "B09-THUMB-HAIR-PONY", "B09-LAYER-HAIR-PONY-FRONT",
                    List.of("B09-LAYER-HAIR-PONY-BACK", "B09-LAYER-HAIR-PONY-FRONT"), true, "ALWAYS"),
            new CharacterItem("NONE", GLASSES, "안경 없음", "B09-THUMB-GLASSES-NONE", null,
                    List.of(), true, "ALWAYS"),
            new CharacterItem("ROUND", GLASSES, "동그란 안경", "B09-THUMB-GLASSES-ROUND", "B09-LAYER-GLASSES-ROUND",
                    List.of("B09-LAYER-GLASSES-ROUND"), true, "ALWAYS"),
            new CharacterItem("SQUARE", GLASSES, "네모 안경", "B09-THUMB-GLASSES-SQUARE", "B09-LAYER-GLASSES-SQUARE",
                    List.of("B09-LAYER-GLASSES-SQUARE"), true, "ALWAYS")
    );

    private final CharacterEquipmentRepository equipment;
    private final UserRepository users;
    private final CharacterRewardRepository rewards;
    private final CharacterGrowthService growth;
    public CharacterService(CharacterEquipmentRepository equipment, UserRepository users,
            CharacterRewardRepository rewards, CharacterGrowthService growth) {
        this.equipment = equipment;
        this.users = users;
        this.rewards = rewards;
        this.growth = growth;
    }

    @Transactional(readOnly = true)
    public CharacterState state(Long userId) {
        CharacterEquipment row = equipment.findById(userId).orElse(null);
        return stateFor(row == null ? "BASE" : row.getOutfitItemId(),
                row == null ? "CLASSIC" : row.getHairItemId(),
                row == null ? "NONE" : row.getGlassesItemId(), growth.progress(userId));
    }

    public List<CharacterItem> items() { return ITEMS; }
    @Transactional(readOnly = true)
    public List<CharacterItem> items(Long userId) {
        var owned = rewards.findByUserId(userId).stream().map(reward -> reward.getItemId())
                .collect(java.util.stream.Collectors.toSet());
        return ITEMS.stream().map(item -> owned.contains(item.id())
                ? new CharacterItem(item.id(), item.slot(), item.name(), item.thumbnailAssetId(), item.assetId(),
                        item.layerAssetIds(), true, item.availabilityCondition()) : item).toList();
    }

    @Transactional
    public CharacterState equip(Long userId, String slot, EquipItemRequest request) {
        if (!List.of(OUTFIT, HAIR, GLASSES).contains(slot) || request == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        String itemId = request.itemId() == null ? defaultFor(slot) : request.itemId();
        CharacterItem item = find(slot, itemId);
        // Locking the owner serializes both the first insert and changes to different slots.
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!item.available() && !rewards.existsByUserIdAndItemId(userId, itemId))
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        CharacterEquipment row = equipment.findById(userId).orElse(null);
        if (row != null && COMPLETE_OUTFITS.contains(row.getOutfitItemId()) && !slot.equals(OUTFIT))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "전체 의상 착용 중에는 헤어와 안경을 변경할 수 없습니다.");
        if (row == null) {
            row = new CharacterEquipment(userId, "BASE");
            row.equip(slot, itemId);
            equipment.saveAndFlush(row);
        } else {
            row.equip(slot, itemId);
            equipment.flush();
        }
        return stateFor(row.getOutfitItemId(), row.getHairItemId(), row.getGlassesItemId(), growth.progress(userId));
    }

    private static String defaultFor(String slot) {
        return switch (slot) {
            case OUTFIT -> "BASE";
            case HAIR -> "CLASSIC";
            case GLASSES -> "NONE";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        };
    }

    private static CharacterItem find(String slot, String id) {
        return ITEMS.stream().filter(item -> item.slot().equals(slot) && item.id().equals(id))
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST));
    }

    private static CharacterState stateFor(String outfitId, String hairId, String glassesId, CharacterProgress progress) {
        CharacterItem outfit = find(OUTFIT, outfitId);
        CharacterItem hair = find(HAIR, hairId);
        CharacterItem glasses = find(GLASSES, glassesId);
        if (COMPLETE_OUTFITS.contains(outfitId))
            return new CharacterState("EXT-IMG-06A", OUTFIT, outfit.id(), outfit.assetId(),
                    Map.of(OUTFIT, outfit.id(), HAIR, hair.id(), GLASSES, glasses.id()), outfit.layerAssetIds(), progress);
        List<String> layers = new java.util.ArrayList<>();
        layers.add(hair.layerAssetIds().get(0));
        layers.add(BODY);
        layers.addAll(outfit.layerAssetIds());
        layers.add(hair.layerAssetIds().get(1));
        layers.addAll(glasses.layerAssetIds());
        return new CharacterState("EXT-IMG-06A", OUTFIT, outfit.id(), outfit.assetId(),
                Map.of(OUTFIT, outfit.id(), HAIR, hair.id(), GLASSES, glasses.id()), List.copyOf(layers), progress);
    }
}
