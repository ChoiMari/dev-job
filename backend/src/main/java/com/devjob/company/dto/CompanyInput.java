package com.devjob.company.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.*;
import java.io.IOException;

public record CompanyInput(
        @NotBlank @Size(max = 200) @JsonDeserialize(using = StrictText.class) String name,
        @Size(max = 2048) @JsonDeserialize(using = StrictText.class) String websiteUrl,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String note,
        @NotNull CompanyStatus status) {
    @AssertTrue public boolean isTextValid() {
        for (String value : new String[]{name, websiteUrl, note}) {
            if (value != null && value.codePoints().anyMatch(c ->
                    Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t'
                    || Character.getType(c) == Character.FORMAT)) return false;
        }
        return true;
    }
    public static class StrictText extends JsonDeserializer<String> {
        @Override public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (parser.currentToken() != JsonToken.VALUE_STRING)
                return (String) context.handleUnexpectedToken(String.class, parser);
            return parser.getText();
        }
    }
}
