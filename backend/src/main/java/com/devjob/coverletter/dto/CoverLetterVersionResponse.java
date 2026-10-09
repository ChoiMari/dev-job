package com.devjob.coverletter.dto;

import com.devjob.coverletter.entity.CoverLetterVersion;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CoverLetterVersionResponse(Long id, Long coverLetterId, int versionNumber, Instant createdAt, String content) {
    public static CoverLetterVersionResponse metadata(CoverLetterVersion version) {
        return new CoverLetterVersionResponse(version.getId(), version.getCoverLetterId(), version.getVersionNumber(), version.getCreatedAt(), null);
    }
    public static CoverLetterVersionResponse detail(CoverLetterVersion version, String content) {
        return new CoverLetterVersionResponse(version.getId(), version.getCoverLetterId(), version.getVersionNumber(), version.getCreatedAt(), content);
    }
}
