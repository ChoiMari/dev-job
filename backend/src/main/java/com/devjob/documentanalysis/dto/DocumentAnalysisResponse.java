package com.devjob.documentanalysis.dto;

import com.devjob.documentanalysis.entity.DocumentAnalysis;
import java.time.Instant;
import java.util.List;

public record DocumentAnalysisResponse(Long id, String status, Source source, boolean stale,
        Result result, String failureReason, Instant consentedAt, Instant analyzedAt, Instant updatedAt) {
    public record Source(String documentType, Long documentId, Long versionId, int versionNumber, Instant createdAt) { }
    public record Result(List<String> skills, List<String> strengths, List<String> improvements) { }
    public static DocumentAnalysisResponse from(DocumentAnalysis analysis, Source source, boolean stale, Result result) {
        return new DocumentAnalysisResponse(analysis.getId(), analysis.getStatus().name(), source, stale,
                result, analysis.getFailureReason(), analysis.getConsentedAt(), analysis.getAnalyzedAt(), analysis.getUpdatedAt());
    }
}
