package com.devjob.project.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;

public record ProjectInput(
        @NotBlank @Size(max = 100) @JsonDeserialize(using = StrictText.class) String name,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String description,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @Size(max = 100) @JsonDeserialize(using = StrictText.class) String role,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String keyFeatures,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String outcome,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String projectUrl,
        @NotNull @JsonDeserialize(contentUsing = StrictId.class) List<@NotNull @Positive Long> skillIds) {
    public ProjectInput {
        name = optional(name); description = optional(description); role = optional(role);
        keyFeatures = optional(keyFeatures); outcome = optional(outcome); projectUrl = optional(projectUrl);
    }
    private static String optional(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    @AssertTrue public boolean isDateRangeValid() {
        return startDate == null || endDate == null || !endDate.isBefore(startDate);
    }
    @AssertTrue public boolean isUrlValid() {
        if (projectUrl == null) return true;
        try {
            URI uri = URI.create(projectUrl);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getRawUserInfo() == null;
        } catch (IllegalArgumentException exception) { return false; }
    }
    @AssertTrue public boolean isTextValid() {
        for (String value : new String[]{name, description, role, keyFeatures, outcome, projectUrl}) {
            if (value != null && value.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) return false;
        }
        return true;
    }
    public static class StrictText extends JsonDeserializer<String> {
        @Override public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_STRING) return (String) context.handleUnexpectedToken(String.class, parser);
            return parser.getText();
        }
    }
    public static class StrictId extends JsonDeserializer<Long> {
        @Override public Long deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) return (Long) context.handleUnexpectedToken(Long.class, parser);
            return parser.getLongValue();
        }
    }
}
