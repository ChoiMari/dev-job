package com.devjob.resume.dto;

import com.devjob.resume.entity.ResumeVersion;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ResumeVersionResponse(Long id, Long resumeId, int versionNumber, Instant createdAt, String title, String description, String content, JsonNode form) {
    public static ResumeVersionResponse metadata(ResumeVersion version) {
        return new ResumeVersionResponse(version.getId(), version.getResumeId(), version.getVersionNumber(), version.getCreatedAt(), version.getTitle(), version.getDescription(), null, null);
    }
    public static ResumeVersionResponse detail(ResumeVersion version, String content, JsonNode form) {
        return new ResumeVersionResponse(version.getId(), version.getResumeId(), version.getVersionNumber(), version.getCreatedAt(), version.getTitle(), version.getDescription(), content, form);
    }
}
