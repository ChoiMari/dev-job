package com.devjob.todo.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.NotNull;
import java.io.IOException;

public record TodoCompletionInput(@NotNull @JsonDeserialize(using = StrictBoolean.class) Boolean completed) {
    public static class StrictBoolean extends JsonDeserializer<Boolean> {
        @Override public Boolean deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_TRUE && parser.currentToken() != JsonToken.VALUE_FALSE)
                return (Boolean) context.handleUnexpectedToken(Boolean.class, parser);
            return parser.getBooleanValue();
        }
    }
}
