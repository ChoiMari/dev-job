package com.devjob.company.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record CompanyPatch(JsonNode body) {
    private static final Set<String> FIELDS = Set.of("name", "websiteUrl", "note", "status",
            "industry", "companySize", "region", "interestLevel", "favorite", "tags");

    public static CompanyPatch from(JsonNode node) {
        if (node == null || !node.isObject() || node.isEmpty()) throw invalid();
        var names = node.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!FIELDS.contains(name)) throw invalid();
            JsonNode value = node.get(name);
            if (name.equals("tags")) {
                if (!value.isNull() && (!value.isArray() || !allText(value))) throw invalid();
            } else if (name.equals("favorite")) {
                if (!value.isBoolean()) throw invalid();
            } else if ((!value.isNull() && !value.isTextual())
                    || (value.isNull() && Set.of("name", "status").contains(name))) throw invalid();
        }
        return new CompanyPatch(node);
    }
    private static boolean allText(JsonNode array) {
        for (JsonNode value : array) if (!value.isTextual()) return false;
        return true;
    }
    private String text(String field, String current) {
        return !body.has(field) ? current : body.get(field).isNull() ? null : body.get(field).textValue();
    }
    private <T extends Enum<T>> T choice(String field, T current, Class<T> type) {
        if (!body.has(field)) return current;
        if (body.get(field).isNull()) return null;
        try { return Enum.valueOf(type, body.get(field).textValue()); }
        catch (IllegalArgumentException exception) { throw invalid(); }
    }
    public CompanyInput merge(CompanyResponse current) {
        List<String> tags = current.tags();
        if (body.has("tags")) {
            tags = new ArrayList<>();
            if (!body.get("tags").isNull()) for (JsonNode tag : body.get("tags")) tags.add(tag.textValue());
        }
        return new CompanyInput(text("name", current.name()), text("websiteUrl", current.websiteUrl()),
                text("note", current.note()), choice("status", current.status(), CompanyStatus.class),
                text("industry", current.industry()), choice("companySize", current.companySize(), CompanySize.class),
                text("region", current.region()), choice("interestLevel", current.interestLevel(), InterestLevel.class),
                body.has("favorite") ? body.get("favorite").booleanValue() : current.favorite(), tags);
    }
    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
