package com.devjob.documentanalysis.service;

import com.devjob.documentanalysis.dto.DocumentAnalysisResponse.Result;
import com.devjob.skill.service.SkillName;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DocumentOutputValidator {
    private final ObjectMapper mapper;
    private final DocumentRedactor redactor;
    public DocumentOutputValidator(ObjectMapper mapper, DocumentRedactor redactor) {
        this.mapper = mapper; this.redactor = redactor;
    }
    public Result parse(String raw) {
        try {
            if (raw == null || raw.length() > 12000) throw new IllegalArgumentException();
            JsonNode root = mapper.readTree(raw);
            if (root == null || !root.isObject() || root.size() != 3) throw new IllegalArgumentException();
            var skills = values(root.get("skills"), 20, 100, true);
            var strengths = values(root.get("strengths"), 5, 200, false);
            var improvements = values(root.get("improvements"), 5, 200, false);
            return new Result(skills, strengths, improvements);
        } catch (Exception ignored) {
            throw new IllegalArgumentException("Invalid document analysis output");
        }
    }
    private List<String> values(JsonNode node, int maxItems, int maxLength, boolean skill) {
        if (node == null || !node.isArray() || node.size() > maxItems) throw new IllegalArgumentException();
        var normalized = new LinkedHashSet<String>();
        for (JsonNode item : node) {
            if (!item.isTextual()) throw new IllegalArgumentException();
            String value = item.textValue().strip().replaceAll("[ \\t]+", " ");
            if (value.isEmpty() || value.length() > maxLength || redactor.containsStructuredPersonalData(value)
                    || value.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n')) throw new IllegalArgumentException();
            normalized.add(skill ? SkillName.parse(value).display() : value);
        }
        return List.copyOf(new ArrayList<>(normalized));
    }
}
