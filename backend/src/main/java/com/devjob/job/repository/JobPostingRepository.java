package com.devjob.job.repository;

import com.devjob.job.entity.JobPosting;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobPostingRepository extends JpaRepository<JobPosting, Long> {
    Optional<JobPosting> findByJobSourceIdAndExternalId(Long jobSourceId, String externalId);
}
