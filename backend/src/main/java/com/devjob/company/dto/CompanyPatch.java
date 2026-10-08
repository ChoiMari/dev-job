package com.devjob.company.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record CompanyPatch(boolean hasName, String name, boolean hasWebsiteUrl, String websiteUrl,
        boolean hasNote, String note, boolean hasStatus, CompanyStatus status) {
    private static final Set<String> FIELDS = Set.of("name", "websiteUrl", "note", "status");

    public static CompanyPatch from(JsonNode node) {
        if (node == null || !node.isObject() || node.isEmpty()) throw invalid();
        var names = node.fieldNames();
        while (names.hasNext()) if (!FIELDS.contains(names.next())) throw invalid();
        boolean hasName = node.has("name"), hasWebsite = node.has("websiteUrl");
        boolean hasNote = node.has("note"), hasStatus = node.has("status");
        if (hasName && (node.get("name").isNull() || !node.get("name").isTextual())) throw invalid();
        if (hasWebsite && !node.get("websiteUrl").isNull() && !node.get("websiteUrl").isTextual()) throw invalid();
        if (hasNote && !node.get("note").isNull() && !node.get("note").isTextual()) throw invalid();
        if (hasStatus && !node.get("status").isTextual()) throw invalid();
        CompanyStatus status = null;
        if (hasStatus) {
            try { status = CompanyStatus.valueOf(node.get("status").textValue()); }
            catch (IllegalArgumentException exception) { throw invalid(); }
        }
        return new CompanyPatch(hasName, hasName ? node.get("name").textValue() : null,
                hasWebsite, hasWebsite && !node.get("websiteUrl").isNull() ? node.get("websiteUrl").textValue() : null,
                hasNote, hasNote && !node.get("note").isNull() ? node.get("note").textValue() : null,
                hasStatus, status);
    }
    public CompanyInput merge(CompanyResponse current) {
        return new CompanyInput(hasName ? name : current.name(),
                hasWebsiteUrl ? websiteUrl : current.websiteUrl(),
                hasNote ? note : current.note(), hasStatus ? status : current.status());
    }
    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
