package com.devjob.resume.dto;

import com.devjob.resume.entity.Resume;
import com.devjob.resume.entity.ResumeVersion;
import java.time.Instant;

public record ResumeResponse(Long id, String title, Long latestVersionId, Integer latestVersionNumber, long versionCount,
        Instant latestVersionCreatedAt, Instant createdAt, Instant updatedAt) {
    public static ResumeResponse from(Resume resume, ResumeVersion latest, long versionCount) {
        return new ResumeResponse(resume.getId(), resume.getTitle(), latest.getId(), latest.getVersionNumber(), versionCount,
                latest.getCreatedAt(), resume.getCreatedAt(), resume.getUpdatedAt());
    }
}
