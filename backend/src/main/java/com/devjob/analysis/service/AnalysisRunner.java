package com.devjob.analysis.service;

import com.devjob.analysis.adapter.AnalysisGateway;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
public class AnalysisRunner {
    private final AnalysisGateway gateway;
    private final AnalysisOutputValidator validator;
    private final AnalysisWriter writer;
    public AnalysisRunner(AnalysisGateway gateway, AnalysisOutputValidator validator, AnalysisWriter writer) {
        this.gateway = gateway; this.validator = validator; this.writer = writer;
    }
    public void run(long jobId, Instant attempt, String title, String description) {
        try {
            writer.complete(jobId, attempt, validator.parse(gateway.analyze(title, description)));
        } catch (Exception exception) {
            // Provider and malformed output details must never reach CRM responses or logs.
            writer.fail(jobId, attempt);
        }
    }
    public void fail(long jobId, Instant attempt) { writer.fail(jobId, attempt); }
}
