package com.devjob.resume.dto;

import com.devjob.resume.entity.Resume;
import com.devjob.resume.entity.ResumeVersion;
import java.time.Instant;

public record ResumeResponse(Long id, String title, Long latestVersionId, Integer latestVersionNumber,
        Instant latestVersionCreatedAt, Instant createdAt, Instant updatedAt) {
    public static ResumeResponse from(Resume resume, ResumeVersion latest) {
        return new ResumeResponse(resume.getId(), resume.getTitle(), latest.getId(), latest.getVersionNumber(),
                latest.getCreatedAt(), resume.getCreatedAt(), resume.getUpdatedAt());
    }
}
