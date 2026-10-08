package com.devjob.skill.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record SkillExperiencePatch(boolean levelPresent, Integer level, boolean monthsPresent, Integer months) {
    private static final Set<String> FIELDS = Set.of("proficiencyLevel", "experienceMonths");

    public static SkillExperiencePatch from(JsonNode input) {
        if (input == null || !input.isObject() || input.size() == 0 || input.size() > 2
                || !input.properties().stream().allMatch(entry -> FIELDS.contains(entry.getKey()))) invalid();
        boolean levelPresent = input.has("proficiencyLevel");
        boolean monthsPresent = input.has("experienceMonths");
        Integer level = parse(input.get("proficiencyLevel"), 1, 5);
        Integer months = parse(input.get("experienceMonths"), 0, 600);
        return new SkillExperiencePatch(levelPresent, level, monthsPresent, months);
    }

    private static Integer parse(JsonNode value, int min, int max) {
        if (value == null || value.isNull()) return null;
        if (!value.isIntegralNumber() || !value.canConvertToInt()) invalid();
        int number = value.intValue();
        if (number < min || number > max) invalid();
        return number;
    }

    private static void invalid() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
