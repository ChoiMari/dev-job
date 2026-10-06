package com.devjob.analysis.repository;

import com.devjob.analysis.entity.AIAnalysis;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AIAnalysisRepository extends JpaRepository<AIAnalysis, Long> {
    Optional<AIAnalysis> findByJobId(Long jobId);
}
