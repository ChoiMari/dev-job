package com.devjob.character.service;

import com.devjob.character.dto.*;
import com.devjob.character.entity.CharacterEquipment;
import com.devjob.character.repository.CharacterEquipmentRepository;
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
    private static final List<CharacterItem> ITEMS = List.of(
            new CharacterItem("BASE", OUTFIT, "기본 의상", "EXT-IMG-06G", "EXT-IMG-06A",
                    List.of("B09-LAYER-OUTFIT-BASE"), true, "ALWAYS"),
            new CharacterItem("MINT", OUTFIT, "민트 후드", "EXT-IMG-06E", "EXT-IMG-06C",
                    List.of("B09-LAYER-OUTFIT-MINT"), true, "ALWAYS"),
            new CharacterItem("PEACH", OUTFIT, "복숭아 재킷", "EXT-IMG-06F", "EXT-IMG-06D",
                    List.of("B09-LAYER-OUTFIT-PEACH"), false, "FUTURE_REWARD"),
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
    public CharacterService(CharacterEquipmentRepository equipment, UserRepository users) {
        this.equipment = equipment;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public CharacterState state(Long userId) {
        CharacterEquipment row = equipment.findById(userId).orElse(null);
        return stateFor(row == null ? "BASE" : row.getOutfitItemId(),
                row == null ? "CLASSIC" : row.getHairItemId(),
                row == null ? "NONE" : row.getGlassesItemId());
    }

    public List<CharacterItem> items() { return ITEMS; }

    @Transactional
    public CharacterState equip(Long userId, String slot, EquipItemRequest request) {
        if (!List.of(OUTFIT, HAIR, GLASSES).contains(slot) || request == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        String itemId = request.itemId() == null ? defaultFor(slot) : request.itemId();
        CharacterItem item = find(slot, itemId);
        if (!item.available()) throw new ResponseStatusException(HttpStatus.CONFLICT);

        // Locking the owner serializes both the first insert and changes to different slots.
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        CharacterEquipment row = equipment.findById(userId).orElse(null);
        if (row == null) {
            row = new CharacterEquipment(userId, "BASE");
            row.equip(slot, itemId);
            equipment.saveAndFlush(row);
        } else {
            row.equip(slot, itemId);
            equipment.flush();
        }
        return stateFor(row.getOutfitItemId(), row.getHairItemId(), row.getGlassesItemId());
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

    private static CharacterState stateFor(String outfitId, String hairId, String glassesId) {
        CharacterItem outfit = find(OUTFIT, outfitId);
        CharacterItem hair = find(HAIR, hairId);
        CharacterItem glasses = find(GLASSES, glassesId);
        List<String> layers = new java.util.ArrayList<>();
        layers.add(hair.layerAssetIds().get(0));
        layers.add(BODY);
        layers.addAll(outfit.layerAssetIds());
        layers.add(hair.layerAssetIds().get(1));
        layers.addAll(glasses.layerAssetIds());
        return new CharacterState("EXT-IMG-06A", OUTFIT, outfit.id(), outfit.assetId(),
                Map.of(OUTFIT, outfit.id(), HAIR, hair.id(), GLASSES, glasses.id()), List.copyOf(layers));
    }
}
