package com.devjob.character.dto;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record EquipItemRequest(String itemId) {
    public static EquipItemRequest parse(JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 1 || !body.has("itemId"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        JsonNode value = body.get("itemId");
        if (!value.isNull() && !value.isTextual()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return new EquipItemRequest(value.isNull() ? null : value.textValue());
    }
}
