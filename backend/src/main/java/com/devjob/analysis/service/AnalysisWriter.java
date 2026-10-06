package com.devjob.analysis.service;

import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.analysis.entity.JobSkill;
import com.devjob.analysis.repository.AIAnalysisRepository;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.skill.service.SkillNormalizer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalysisWriter {
    private final JobPostingRepository jobs;
    private final AIAnalysisRepository analyses;
    private final JobSkillRepository jobSkills;
    private final SkillNormalizer normalizer;
    private final ObjectMapper mapper;
    public AnalysisWriter(JobPostingRepository jobs, AIAnalysisRepository analyses, JobSkillRepository jobSkills,
            SkillNormalizer normalizer, ObjectMapper mapper) {
        this.jobs = jobs; this.analyses = analyses; this.jobSkills = jobSkills; this.normalizer = normalizer; this.mapper = mapper;
    }
    @Transactional
    public void complete(long jobId, Instant attempt, List<AnalysisOutputValidator.ExtractedSkill> extracted) {
        var job = jobs.lockById(jobId).orElseThrow();
        var analysis = analyses.findByJobId(jobId).orElseThrow();
        if (analysis.getStatus() != AIAnalysis.Status.PENDING || !analysis.getUpdatedAt().equals(attempt)) return;
        Map<Long, JobSkill> canonical = new LinkedHashMap<>();
        for (var item : extracted) {
            var skill = normalizer.resolveForAnalysis(item.name());
            var old = canonical.get(skill.getId());
            if (old == null || item.type() == JobSkill.RequirementType.REQUIRED)
                canonical.put(skill.getId(), new JobSkill(job, skill, item.type()));
        }
        var values = canonical.values().stream().map(s -> Map.of("name", s.getSkill().getName(),
                "requirementType", s.getRequirementType().name())).toList();
        try {
            String json = mapper.writeValueAsString(Map.of("skills", values));
            jobSkills.deleteForJob(jobId);
            jobSkills.saveAll(canonical.values());
            analysis.completed(json);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize validated analysis");
        }
    }
    @Transactional
    public void fail(long jobId, Instant attempt) {
        jobs.lockById(jobId).orElseThrow();
        var analysis = analyses.findByJobId(jobId).orElseThrow();
        if (analysis.getStatus() == AIAnalysis.Status.PENDING && analysis.getUpdatedAt().equals(attempt)) analysis.failed();
    }
}
