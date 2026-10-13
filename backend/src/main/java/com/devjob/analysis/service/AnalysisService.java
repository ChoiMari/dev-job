package com.devjob.analysis.service;

import com.devjob.analysis.dto.AnalysisResponse;
import com.devjob.analysis.adapter.AnalysisGateway;
import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.analysis.repository.AIAnalysisRepository;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.skill.service.AccountSkillService;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Service
public class AnalysisService {
    public record RequestResult(AnalysisResponse body, boolean accepted) { }
    private final JobPostingRepository jobs;
    private final BookmarkRepository bookmarks;
    private final AIAnalysisRepository analyses;
    private final JobSkillRepository jobSkills;
    private final AnalysisRunner runner;
    private final AnalysisGateway gateway;
    private final AccountSkillService accountSkills;
    private final Executor executor;
    public AnalysisService(JobPostingRepository jobs, BookmarkRepository bookmarks, AIAnalysisRepository analyses, JobSkillRepository jobSkills,
            AnalysisRunner runner, AnalysisGateway gateway, AccountSkillService accountSkills,
            @Qualifier("analysisExecutor") Executor analysisExecutor) {
        this.jobs = jobs; this.bookmarks = bookmarks; this.analyses = analyses; this.jobSkills = jobSkills;
        this.runner = runner; this.gateway = gateway; this.accountSkills = accountSkills; this.executor = analysisExecutor;
    }
    @Transactional
    public RequestResult request(Long userId, long jobId) {
        if (jobId < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var job = jobs.lockById(jobId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!bookmarks.existsByUserIdAndJobId(userId, jobId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        var existing = analyses.findByJobId(jobId);
        if (existing.isPresent()) {
            var analysis = existing.get();
            if (analysis.getStatus() == AIAnalysis.Status.COMPLETED) {
                accountSkills.recordAnalysisRequester(userId, jobId);
                accountSkills.publishCompletedJob(userId, jobId);
                return new RequestResult(AnalysisResponse.from(analysis, jobSkills.findForJob(jobId)), false);
            }
            if (analysis.getStatus() == AIAnalysis.Status.PENDING
                    && Duration.between(analysis.getUpdatedAt(), Instant.now()).compareTo(Duration.ofMinutes(5)) < 0) {
                accountSkills.recordAnalysisRequester(userId, jobId);
                return new RequestResult(AnalysisResponse.from(analysis, java.util.List.of()), true);
            }
        }
        if (!gateway.available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI 분석 서버 키가 설정되지 않았습니다.");
        accountSkills.recordAnalysisRequester(userId, jobId);
        var analysis = existing.orElseGet(() -> new AIAnalysis(job));
        if (existing.isPresent()) analysis.pending();
        analyses.saveAndFlush(analysis);
        var attempt = analysis.getUpdatedAt();
        var title = job.getTitle();
        var description = job.getDescription();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { executor.execute(() -> runner.run(jobId, attempt, title, description)); }
                catch (RuntimeException exception) { runner.fail(jobId, attempt); }
            }
        });
        return new RequestResult(AnalysisResponse.from(analysis, java.util.List.of()), true);
    }
    @Transactional(readOnly = true)
    public AnalysisResponse get(long jobId) {
        if (jobId < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (!jobs.existsById(jobId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var analysis = analyses.findByJobId(jobId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return AnalysisResponse.from(analysis, analysis.getStatus() == AIAnalysis.Status.COMPLETED
                ? jobSkills.findForJob(jobId) : java.util.List.of());
    }
    @Configuration
    static class ExecutorConfig {
        @Bean("analysisExecutor")
        ThreadPoolTaskExecutor analysisExecutor() {
            var executor = new ThreadPoolTaskExecutor();
            executor.setCorePoolSize(2);
            executor.setMaxPoolSize(2);
            executor.setQueueCapacity(50);
            executor.setThreadNamePrefix("job-analysis-");
            return executor;
        }
    }
}
