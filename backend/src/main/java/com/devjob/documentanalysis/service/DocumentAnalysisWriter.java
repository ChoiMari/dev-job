package com.devjob.documentanalysis.service;

import com.devjob.documentanalysis.dto.DocumentAnalysisResponse.Result;
import com.devjob.documentanalysis.entity.DocumentAnalysis;
import com.devjob.documentanalysis.repository.DocumentAnalysisRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentAnalysisWriter {
    private final DocumentAnalysisRepository analyses;
    private final DocumentResultCipher cipher;
    private final ObjectMapper mapper;
    public DocumentAnalysisWriter(DocumentAnalysisRepository analyses, DocumentResultCipher cipher, ObjectMapper mapper) {
        this.analyses = analyses; this.cipher = cipher; this.mapper = mapper;
    }
    @Transactional
    public void complete(long id, Instant attempt, Result result) {
        var analysis = analyses.findForUpdate(id).orElse(null);
        if (!current(analysis, attempt)) return;
        try {
            var encrypted = cipher.encrypt(id, mapper.writeValueAsString(result));
            analysis.completed(encrypted.ciphertext(), encrypted.nonce());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Invalid normalized result");
        }
    }
    @Transactional
    public void fail(long id, Instant attempt) {
        var analysis = analyses.findForUpdate(id).orElse(null);
        if (current(analysis, attempt)) analysis.failed();
    }
    private static boolean current(DocumentAnalysis analysis, Instant attempt) {
        return analysis != null && analysis.getStatus() == DocumentAnalysis.Status.PENDING
                && analysis.getUpdatedAt().equals(attempt);
    }
}
