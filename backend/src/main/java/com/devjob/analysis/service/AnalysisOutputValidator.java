package com.devjob.analysis.service;

import com.devjob.analysis.entity.JobSkill.RequirementType;
import com.devjob.skill.service.SkillName;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class AnalysisOutputValidator {
    public record ExtractedSkill(String name, RequirementType type) { }
    private final ObjectMapper mapper;
    public AnalysisOutputValidator(ObjectMapper mapper) { this.mapper = mapper; }
    public List<ExtractedSkill> parse(String raw) {
        try {
            if (raw == null || raw.length() > 16000) throw new IllegalArgumentException();
            JsonNode root = mapper.readTree(raw);
            if (root == null || !root.isObject() || root.size() != 1 || !root.has("skills") || !root.get("skills").isArray()
                    || root.get("skills").size() > 40) throw new IllegalArgumentException();
            var result = new ArrayList<ExtractedSkill>();
            for (JsonNode item : root.get("skills")) {
                if (!item.isObject() || item.size() != 2 || !item.has("name") || !item.get("name").isTextual()
                        || !item.has("requirementType") || !item.get("requirementType").isTextual()) throw new IllegalArgumentException();
                var name = SkillName.parse(item.get("name").textValue()).display();
                var type = RequirementType.valueOf(item.get("requirementType").textValue());
                result.add(new ExtractedSkill(name, type));
            }
            return List.copyOf(result);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid AI output");
        }
    }
}
