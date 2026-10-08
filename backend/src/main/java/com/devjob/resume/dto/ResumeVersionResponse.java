package com.devjob.resume.dto;

import com.devjob.resume.entity.ResumeVersion;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ResumeVersionResponse(Long id, Long resumeId, int versionNumber, Instant createdAt, String content) {
    public static ResumeVersionResponse metadata(ResumeVersion version) {
        return new ResumeVersionResponse(version.getId(), version.getResumeId(), version.getVersionNumber(), version.getCreatedAt(), null);
    }
    public static ResumeVersionResponse detail(ResumeVersion version, String content) {
        return new ResumeVersionResponse(version.getId(), version.getResumeId(), version.getVersionNumber(), version.getCreatedAt(), content);
    }
}
