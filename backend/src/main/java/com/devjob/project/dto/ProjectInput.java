package com.devjob.project.dto;

import com.devjob.project.entity.ProjectType;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.net.URI;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

public record ProjectInput(
        @NotBlank @Size(max = 100) @JsonDeserialize(using = StrictText.class) String name,
        ProjectType projectType,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String description,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @Size(max = 100) @JsonDeserialize(using = StrictText.class) String role,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String keyFeatures,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String outcome,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String projectUrl,
        @NotNull @JsonDeserialize(contentUsing = StrictId.class) List<@NotNull @Positive Long> skillIds,
        @Size(max = 200) @JsonDeserialize(using = StrictText.class) String summary,
        @Size(max = 100) @JsonDeserialize(using = StrictText.class) String category,
        @Min(1) @Max(99) Integer teamSize,
        @Size(max = 1000) @JsonDeserialize(using = StrictText.class) String problemSolving,
        @Size(max = 10) @JsonDeserialize(contentUsing = StrictText.class) List<@NotBlank @Size(max = 2000) String> featureItems,
        @Size(max = 10) @JsonDeserialize(contentUsing = StrictText.class) List<@NotBlank @Size(max = 2000) String> achievementItems,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String demoUrl,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String githubUrl,
        @Size(max = 2000) @JsonDeserialize(using = StrictText.class) String presentationUrl,
        @Min(0) @Max(100) Integer contributionPercent,
        @Size(max = 1000) @JsonDeserialize(using = StrictText.class) String responsibilities,
        @Size(max = 1000) @JsonDeserialize(using = StrictText.class) String troubleshooting,
        @Size(max = 10) @JsonDeserialize(contentUsing = StrictText.class) List<@NotBlank @Size(max = 1000) String> metricItems,
        @Size(max = 100) List<@NotNull @Valid SkillUsageInput> skillUsages,
        @Size(max = 10) List<@NotNull @Valid ContributionItem> contributionItems,
        @Size(max = 10) @JsonDeserialize(contentUsing = StrictText.class) List<@NotBlank @Size(max = 1000) String> troubleshootingItems,
        @Size(max = 20) List<@NotNull @Valid CustomSkillItem> customSkills) {
    public ProjectInput {
        projectType = projectType == null ? ProjectType.UNSPECIFIED : projectType;
        name = optional(name); description = optional(description); role = optional(role);
        keyFeatures = optional(keyFeatures); outcome = optional(outcome); projectUrl = optional(projectUrl);
        summary = optional(summary); category = optional(category); problemSolving = optional(problemSolving);
        demoUrl = optional(demoUrl); githubUrl = optional(githubUrl); presentationUrl = optional(presentationUrl);
        responsibilities = optional(responsibilities); troubleshooting = optional(troubleshooting);
        featureItems = featureItems == null ? List.of() : featureItems.stream().map(ProjectInput::optional).toList();
        achievementItems = achievementItems == null ? List.of() : achievementItems.stream().map(ProjectInput::optional).toList();
        metricItems = metricItems == null ? List.of() : metricItems.stream().map(ProjectInput::optional).toList();
        skillUsages = skillUsages == null ? List.of() : new ArrayList<>(skillUsages);
        contributionItems = contributionItems == null ? List.of() : new ArrayList<>(contributionItems);
        troubleshootingItems = troubleshootingItems == null ? List.of() : troubleshootingItems.stream().map(ProjectInput::optional).toList();
        customSkills = customSkills == null ? List.of() : new ArrayList<>(customSkills);
    }
    private static String optional(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    @AssertTrue public boolean isDateRangeValid() {
        return startDate == null || endDate == null || !endDate.isBefore(startDate);
    }
    @AssertTrue public boolean isUrlValid() {
        return validUrl(projectUrl) && validUrl(demoUrl) && validUrl(githubUrl) && validUrl(presentationUrl);
    }
    private static boolean validUrl(String url) {
        if (url == null) return true;
        try {
            URI uri = URI.create(url);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getRawUserInfo() == null;
        } catch (IllegalArgumentException exception) { return false; }
    }
    @AssertTrue public boolean isTextValid() {
        for (String value : new String[]{name, description, role, keyFeatures, outcome, projectUrl, summary, category,
                problemSolving, demoUrl, githubUrl, presentationUrl, responsibilities, troubleshooting}) {
            if (value != null && value.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) return false;
        }
        for (String value : featureItems) if (!safe(value)) return false;
        for (String value : achievementItems) if (!safe(value)) return false;
        for (String value : metricItems) if (!safe(value)) return false;
        for (String value : troubleshootingItems) if (!safe(value)) return false;
        for (ContributionItem item : contributionItems) if (item == null || !safe(item.responsibility())) return false;
        for (CustomSkillItem item : customSkills) if (item == null || !safe(item.name()) || item.usage() != null && !safe(item.usage())) return false;
        return true;
    }
    private static boolean safe(String value) { return value != null && value.codePoints().noneMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t'); }
    @AssertTrue public boolean isSkillUsageValid() {
        if (skillIds == null) return true;
        var seen = new HashSet<Long>();
        for (var item : skillUsages) {
            if (item == null || item.skillId() == null || !skillIds.contains(item.skillId()) || !seen.add(item.skillId())
                    || (item.usage() != null && !safe(item.usage()))) return false;
        }
        return true;
    }
    public record SkillUsageInput(@NotNull @Positive @JsonDeserialize(using = StrictId.class) Long skillId,
            @Size(max = 1000) @JsonDeserialize(using = StrictText.class) String usage) { }
    public record ContributionItem(@NotBlank @Size(max = 1000) @JsonDeserialize(using = StrictText.class) String responsibility,
            @NotNull @Min(0) @Max(100) Integer percent) { }
    public record CustomSkillItem(@NotBlank @Size(max = 100) @JsonDeserialize(using = StrictText.class) String name,
            @Size(max = 1000) @JsonDeserialize(using = StrictText.class) String usage) { }
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
