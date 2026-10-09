package com.devjob.documentanalysis.service;

import com.devjob.coverletter.repository.CoverLetterRepository;
import com.devjob.coverletter.repository.CoverLetterVersionRepository;
import com.devjob.coverletter.service.CoverLetterCipher;
import com.devjob.documentanalysis.adapter.DocumentAnalysisGateway;
import com.devjob.documentanalysis.dto.DocumentAnalysisResponse;
import com.devjob.documentanalysis.dto.DocumentAnalysisResponse.Source;
import com.devjob.documentanalysis.entity.DocumentAnalysis;
import com.devjob.documentanalysis.repository.DocumentAnalysisRepository;
import com.devjob.resume.repository.ResumeRepository;
import com.devjob.resume.repository.ResumeVersionRepository;
import com.devjob.resume.service.ResumeCipher;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.Executor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentAnalysisService {
    public enum Type { RESUME, COVER_LETTER }
    public record RequestResult(DocumentAnalysisResponse body, boolean accepted) { }
    private record Selected(Source source, String content, boolean stale) { }
    private final ResumeRepository resumes;
    private final ResumeVersionRepository resumeVersions;
    private final ResumeCipher resumeCipher;
    private final CoverLetterRepository covers;
    private final CoverLetterVersionRepository coverVersions;
    private final CoverLetterCipher coverCipher;
    private final DocumentAnalysisRepository analyses;
    private final DocumentResultCipher resultCipher;
    private final DocumentAnalysisGateway gateway;
    private final DocumentRedactor redactor;
    private final DocumentAnalysisRunner runner;
    private final ObjectMapper mapper;
    private final Executor executor;

    public DocumentAnalysisService(ResumeRepository resumes, ResumeVersionRepository resumeVersions, ResumeCipher resumeCipher,
            CoverLetterRepository covers, CoverLetterVersionRepository coverVersions, CoverLetterCipher coverCipher,
            DocumentAnalysisRepository analyses, DocumentResultCipher resultCipher, DocumentAnalysisGateway gateway,
            DocumentRedactor redactor, DocumentAnalysisRunner runner, ObjectMapper mapper,
            @Qualifier("analysisExecutor") Executor executor) {
        this.resumes = resumes; this.resumeVersions = resumeVersions; this.resumeCipher = resumeCipher;
        this.covers = covers; this.coverVersions = coverVersions; this.coverCipher = coverCipher;
        this.analyses = analyses; this.resultCipher = resultCipher; this.gateway = gateway;
        this.redactor = redactor; this.runner = runner; this.mapper = mapper; this.executor = executor;
    }

    @Transactional
    public RequestResult request(Type type, Long userId, Long documentId, Long versionId, JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 1
                || !body.path("consentToExternalAnalysis").isBoolean()
                || !body.path("consentToExternalAnalysis").booleanValue()) throw badInput();
        Selected selected = select(type, userId, documentId, versionId, true, false);
        Optional<DocumentAnalysis> old = findLocked(type, versionId);
        if (old.isPresent()) {
            var analysis = old.get();
            if (analysis.getStatus() == DocumentAnalysis.Status.COMPLETED)
                return new RequestResult(response(analysis, selected), false);
            if (analysis.getStatus() == DocumentAnalysis.Status.PENDING
                    && Duration.between(analysis.getUpdatedAt(), Instant.now()).compareTo(Duration.ofMinutes(5)) < 0)
                return new RequestResult(response(analysis, selected), true);
        }
        if (!gateway.available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        selected = select(type, userId, documentId, versionId, true, true);
        String redacted = redactor.redact(selected.content());
        if (redacted.length() > 12000) redacted = redacted.substring(0, 12000);
        if (redacted.isBlank()) throw badInput();
        var analysis = old.orElseGet(() -> new DocumentAnalysis(type == Type.RESUME ? versionId : null,
                type == Type.COVER_LETTER ? versionId : null));
        if (old.isPresent()) analysis.pending();
        analyses.saveAndFlush(analysis);
        long analysisId = analysis.getId();
        Instant attempt = analysis.getUpdatedAt();
        String content = redacted;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { executor.execute(() -> runner.run(analysisId, attempt, type.name(), content)); }
                catch (RuntimeException ignored) { runner.fail(analysisId, attempt); }
            }
        });
        return new RequestResult(response(analysis, selected), true);
    }

    @Transactional(readOnly = true)
    public DocumentAnalysisResponse get(Type type, Long userId, Long documentId, Long versionId) {
        Selected selected = select(type, userId, documentId, versionId, false, false);
        DocumentAnalysis analysis = find(type, versionId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return response(analysis, selected);
    }

    @Transactional
    public void delete(Type type, Long userId, Long documentId, Long versionId) {
        select(type, userId, documentId, versionId, true, false);
        findLocked(type, versionId).ifPresent(analyses::delete);
        analyses.flush();
    }

    private Optional<DocumentAnalysis> find(Type type, Long versionId) {
        return type == Type.RESUME ? analyses.findByResumeVersionId(versionId) : analyses.findByCoverLetterVersionId(versionId);
    }
    private Optional<DocumentAnalysis> findLocked(Type type, Long versionId) {
        return type == Type.RESUME ? analyses.findResumeForUpdate(versionId) : analyses.findCoverForUpdate(versionId);
    }
    private DocumentAnalysisResponse response(DocumentAnalysis analysis, Selected selected) {
        DocumentAnalysisResponse.Result result = null;
        if (analysis.getStatus() == DocumentAnalysis.Status.COMPLETED) {
            try {
                result = mapper.readValue(resultCipher.decrypt(analysis.getId(), analysis.getResultCiphertext(),
                        analysis.getResultNonce()), DocumentAnalysisResponse.Result.class);
            } catch (ResponseStatusException exception) { throw exception; }
            catch (Exception ignored) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE); }
        }
        return DocumentAnalysisResponse.from(analysis, selected.source(), selected.stale(), result);
    }
    private Selected select(Type type, Long userId, Long documentId, Long versionId, boolean lock, boolean content) {
        if (documentId == null || documentId <= 0 || versionId == null || versionId <= 0) throw badInput();
        if (type == Type.RESUME) {
            var resume = (lock ? resumes.findForUpdate(documentId) : resumes.findById(documentId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (resume.getDeletedAt() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            if (!resume.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            var version = resumeVersions.owned(versionId, documentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            boolean stale = !resumeVersions.latest(documentId).orElseThrow().getId().equals(versionId);
            return new Selected(new Source(type.name(), documentId, versionId, version.getVersionNumber(),
                    version.getCreatedAt()), content ? resumeCipher.decrypt(documentId, version.getVersionNumber(),
                    version.getContentCiphertext(), version.getContentNonce()) : null, stale);
        }
        var cover = (lock ? covers.findForUpdate(documentId) : covers.findById(documentId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (cover.getDeletedAt() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!cover.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        var version = coverVersions.owned(versionId, documentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        boolean stale = !coverVersions.latest(documentId).orElseThrow().getId().equals(versionId);
        return new Selected(new Source(type.name(), documentId, versionId, version.getVersionNumber(),
                version.getCreatedAt()), content ? coverCipher.decrypt(documentId, version.getVersionNumber(),
                version.getContentCiphertext(), version.getContentNonce()) : null, stale);
    }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
