package com.devjob.learninggoal.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record LearningGoalInput(boolean titlePresent, String title, boolean descriptionPresent, String description,
        boolean skillPresent, Long skillId, boolean progressPresent, Integer progressPercent) {
    private static final Set<String> FIELDS = Set.of("title", "description", "skillId", "progressPercent");

    public static LearningGoalInput from(JsonNode input, boolean create) {
        if (input == null || !input.isObject() || (!create && input.isEmpty())) throw invalid();
        input.fieldNames().forEachRemaining(field -> { if (!FIELDS.contains(field)) throw invalid(); });
        boolean hasTitle = input.has("title");
        boolean hasDescription = input.has("description");
        boolean hasSkill = input.has("skillId");
        boolean hasProgress = input.has("progressPercent");
        if (create && !hasTitle) throw invalid();
        return new LearningGoalInput(hasTitle, hasTitle ? title(input.get("title")) : null,
                hasDescription, hasDescription ? description(input.get("description")) : null,
                hasSkill, hasSkill ? skillId(input.get("skillId")) : null,
                hasProgress, hasProgress ? progress(input.get("progressPercent")) : null);
    }

    public static boolean completion(JsonNode input) {
        if (input == null || !input.isObject() || input.size() != 1 || !input.has("completed")) throw invalid();
        JsonNode value = input.get("completed");
        if (!value.isBoolean()) throw invalid();
        return value.booleanValue();
    }

    public static String title(JsonNode value) {
        if (value == null || !value.isTextual()) throw invalid();
        String source = value.textValue();
        if (source.codePoints().anyMatch(Character::isISOControl)) throw invalid();
        StringBuilder normalized = new StringBuilder();
        boolean space = false;
        for (int cp : source.codePoints().toArray()) {
            if (Character.isWhitespace(cp) || Character.isSpaceChar(cp)) {
                space = normalized.length() > 0;
            } else {
                if (space) normalized.append(' ');
                normalized.appendCodePoint(cp);
                space = false;
            }
        }
        if (normalized.isEmpty() || normalized.length() > 200) throw invalid();
        return normalized.toString();
    }
    private static String description(JsonNode value) {
        if (value.isNull()) return null;
        if (!value.isTextual()) throw invalid();
        String normalized = value.textValue().strip();
        if (normalized.length() > 2000 || normalized.codePoints().anyMatch(Character::isISOControl)) throw invalid();
        return normalized.isEmpty() ? null : normalized;
    }
    private static Long skillId(JsonNode value) {
        if (value.isNull()) return null;
        if (!value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 1) throw invalid();
        return value.longValue();
    }
    private static Integer progress(JsonNode value) {
        if (!value.isIntegralNumber() || !value.canConvertToInt() || value.intValue() < 0 || value.intValue() > 100)
            throw invalid();
        return value.intValue();
    }
    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
