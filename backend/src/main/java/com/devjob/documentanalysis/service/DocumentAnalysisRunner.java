package com.devjob.documentanalysis.service;

import com.devjob.documentanalysis.adapter.DocumentAnalysisGateway;
import com.devjob.documentanalysis.entity.DocumentAnalysis;
import com.devjob.documentanalysis.repository.DocumentAnalysisRepository;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class DocumentAnalysisRunner {
    private final DocumentAnalysisGateway gateway;
    private final DocumentOutputValidator validator;
    private final DocumentAnalysisWriter writer;
    private final DocumentAnalysisRepository analyses;
    public DocumentAnalysisRunner(DocumentAnalysisGateway gateway, DocumentOutputValidator validator,
            DocumentAnalysisWriter writer, DocumentAnalysisRepository analyses) {
        this.gateway = gateway; this.validator = validator; this.writer = writer; this.analyses = analyses;
    }
    public void run(long id, Instant attempt, String type, String redactedContent) {
        try {
            var current = analyses.findById(id);
            if (current.isEmpty() || current.get().getStatus() != DocumentAnalysis.Status.PENDING
                    || !current.get().getUpdatedAt().equals(attempt)) return;
            writer.complete(id, attempt, validator.parse(gateway.analyze(type, redactedContent)));
        } catch (Exception ignored) {
            writer.fail(id, attempt);
        }
    }
    public void fail(long id, Instant attempt) { writer.fail(id, attempt); }
}
