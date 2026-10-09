package com.devjob.character.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.character.dto.*;
import com.devjob.character.service.CharacterService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class CharacterController {
    private final CharacterService characters;
    public CharacterController(CharacterService characters) { this.characters = characters; }

    @GetMapping("/api/me/character")
    public CharacterState state(@AuthenticationPrincipal CurrentUser user) {
        return characters.state(user.id());
    }

    @GetMapping("/api/character/items")
    public List<CharacterItem> items() { return characters.items(); }

    @PutMapping("/api/me/character/equipment/{slot}")
    public CharacterState equip(@AuthenticationPrincipal CurrentUser user, @PathVariable String slot,
            @RequestBody JsonNode request) {
        return characters.equip(user.id(), slot, EquipItemRequest.parse(request));
    }
}
