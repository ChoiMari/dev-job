package com.devjob.application.dto;

import com.devjob.application.entity.ApplicationStatus;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.Set;

/** Strict JSON types and presence-aware PATCH, scoped to application requests. */
public final class ApplicationInput {
    private ApplicationInput() { }
    private static void fields(JsonNode node, Set<String> allowed) {
        if (node == null || !node.isObject()) invalid();
        node.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) invalid(); });
    }
    private static String text(JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) invalid();
        return value.textValue();
    }
    private static String note(JsonNode value) {
        String text = text(value);
        if (text == null) return null;
        if (text.length() > 2000 || text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) invalid();
        return text.isBlank() ? null : text.strip();
    }
    private static LocalDate date(JsonNode value) {
        String text = text(value);
        if (text == null) return null;
        if (!text.matches("\\d{4}-\\d{2}-\\d{2}")) invalid();
        LocalDate date = LocalDate.parse(text);
        if (date.getYear() < 1) invalid();
        return date;
    }
    private static Instant schedule(JsonNode value) {
        String text = text(value);
        if (text == null) return null;
        OffsetDateTime date = OffsetDateTime.parse(text);
        if (date.getYear() < 1 || date.getYear() > 9999) invalid();
        return date.toInstant();
    }
    private static ApplicationStatus status(JsonNode value) {
        String text = text(value);
        if (text == null) invalid();
        return ApplicationStatus.valueOf(text);
    }
    private static Long id(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 1) invalid();
        return value.longValue();
    }
    private static void invalid() { throw new IllegalArgumentException("Invalid application input"); }

    public record Create(Long jobId, ApplicationStatus status, LocalDate appliedDate, String note, Instant nextScheduleAt) {
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public static Create parse(JsonNode node) {
            fields(node, Set.of("jobId", "status", "appliedDate", "note", "nextScheduleAt"));
            return new Create(id(node.get("jobId")), ApplicationInput.status(node.get("status")), date(node.get("appliedDate")),
                    ApplicationInput.note(node.get("note")), schedule(node.get("nextScheduleAt")));
        }
    }
    public record Update(boolean noteProvided, String note, boolean scheduleProvided, Instant nextScheduleAt) {
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public static Update parse(JsonNode node) {
            fields(node, Set.of("note", "nextScheduleAt"));
            if (node.isEmpty()) invalid();
            return new Update(node.has("note"), ApplicationInput.note(node.get("note")), node.has("nextScheduleAt"), schedule(node.get("nextScheduleAt")));
        }
    }
    public record ChangeStatus(ApplicationStatus status, LocalDate appliedDate) {
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public static ChangeStatus parse(JsonNode node) {
            fields(node, Set.of("status", "appliedDate"));
            return new ChangeStatus(ApplicationInput.status(node.get("status")), date(node.get("appliedDate")));
        }
    }
}
