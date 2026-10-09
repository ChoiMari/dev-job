package com.devjob.coverletter.dto;

import com.devjob.coverletter.entity.CoverLetter;
import com.devjob.coverletter.entity.CoverLetterVersion;
import java.time.Instant;

public record CoverLetterResponse(Long id, String title, Long latestVersionId, Integer latestVersionNumber,
        Instant latestVersionCreatedAt, Instant createdAt, Instant updatedAt) {
    public static CoverLetterResponse from(CoverLetter coverLetter, CoverLetterVersion latest) {
        return new CoverLetterResponse(coverLetter.getId(), coverLetter.getTitle(), latest.getId(), latest.getVersionNumber(),
                latest.getCreatedAt(), coverLetter.getCreatedAt(), coverLetter.getUpdatedAt());
    }
}
