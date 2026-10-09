package com.devjob.character.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.character.dto.*;
import com.devjob.character.service.CharacterService;
import com.devjob.character.service.CharacterGrowthService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class CharacterController {
    private final CharacterService characters;
    private final CharacterGrowthService growth;
    public CharacterController(CharacterService characters, CharacterGrowthService growth) {
        this.characters = characters; this.growth = growth;
    }

    @GetMapping("/api/me/character")
    public CharacterState state(@AuthenticationPrincipal CurrentUser user) {
        return characters.state(user.id());
    }

    @GetMapping("/api/character/items")
    public List<CharacterItem> items(@AuthenticationPrincipal CurrentUser user) { return characters.items(user.id()); }

    @GetMapping("/api/me/character/activity")
    public CharacterActivityResponse.Page activity(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return growth.activity(user.id(), page, size);
    }

    @GetMapping("/api/me/character/quests")
    public List<CharacterQuestResponse> quests(@AuthenticationPrincipal CurrentUser user) {
        return growth.quests(user.id());
    }

    @PostMapping("/api/me/character/quests/{questId}/claim")
    public CharacterClaimResponse claim(@AuthenticationPrincipal CurrentUser user, @PathVariable String questId) {
        return growth.claim(user.id(), questId);
    }

    @PutMapping("/api/me/character/equipment/{slot}")
    public CharacterState equip(@AuthenticationPrincipal CurrentUser user, @PathVariable String slot,
            @RequestBody JsonNode request) {
        return characters.equip(user.id(), slot, EquipItemRequest.parse(request));
    }
}
