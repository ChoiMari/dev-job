package com.devjob.resume.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ResumeDraftServiceTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void acceptsFreeDraftWithAllTemplateFieldsPresent() throws Exception {
        var form = json.createObjectNode();
        for (String field : new String[] { "name", "phone", "email", "birth", "desiredRole", "location",
                "employment", "introduction", "link", "blog", "extra" }) form.put(field, "");
        form.putArray("education").addObject().put("school", "").put("major", "").put("degree", "")
                .put("start", "").put("end", "");
        form.putArray("skills");
        form.putArray("projects").addObject().put("name", "").put("start", "").put("end", "")
                .put("description", "").put("role", "").put("skills", "").put("work", "");
        form.putArray("experience").addObject().put("company", "").put("start", "").put("end", "")
                .put("current", false).put("role", "").put("work", "");
        form.putArray("certificates").addObject().put("name", "").put("date", "").put("issuer", "");
        form.putArray("training").addObject().put("name", "").put("provider", "")
                .put("start", "").put("end", "").put("content", "");
        form.putArray("links");
        var draft = json.createObjectNode().put("version", 1).put("mode", "free")
                .put("title", "이력서").put("content", "본문");
        draft.set("form", form);

        assertDoesNotThrow(() -> ResumeDraftService.validate(draft));

        form.put("unexpected", "value");
        assertThrows(ResponseStatusException.class, () -> ResumeDraftService.validate(draft));
    }

    @Test
    void versionDraftRequiresItsPurposeAndMatchingTargetShape() {
        var form = json.createObjectNode();
        for (String field : new String[] { "name", "phone", "email", "birth", "desiredRole", "location",
                "employment", "introduction", "link", "blog", "extra" }) form.put(field, "");
        for (String field : new String[] { "education", "skills", "projects", "experience", "certificates", "training", "links" })
            form.putArray(field);
        var draft = json.createObjectNode().put("version", 2).put("mode", "free")
                .put("title", "버전").put("content", "본문").put("description", "")
                .put("purpose", "version-new").put("resumeId", 5);
        draft.set("form", form);
        assertDoesNotThrow(() -> ResumeDraftService.validate(draft));
        draft.put("purpose", "version-edit");
        assertThrows(ResponseStatusException.class, () -> ResumeDraftService.validate(draft));
        draft.put("versionId", 8);
        assertDoesNotThrow(() -> ResumeDraftService.validate(draft));
        draft.put("resumeId", -1);
        assertThrows(ResponseStatusException.class, () -> ResumeDraftService.validate(draft));
    }
}
