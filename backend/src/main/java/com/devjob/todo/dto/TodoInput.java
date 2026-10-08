package com.devjob.todo.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.time.OffsetDateTime;

public record TodoInput(
        @NotBlank @JsonDeserialize(using = StrictText.class) String title,
        @JsonDeserialize(using = StrictText.class) String description,
        @JsonFormat(without = JsonFormat.Feature.ADJUST_DATES_TO_CONTEXT_TIME_ZONE) OffsetDateTime dueAt,
        @JsonDeserialize(using = StrictText.class) String dueTimeZone) {
    public static class StrictText extends JsonDeserializer<String> {
        @Override public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_STRING) return (String) context.handleUnexpectedToken(String.class, parser);
            return parser.getText();
        }
    }
}
