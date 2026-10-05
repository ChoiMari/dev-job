package com.devjob.job.service;

import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceAdapter;
import com.devjob.job.model.NormalizedJobPosting;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import static com.devjob.job.service.JobCollectionResult.Status.*;

@Service
public class JobCollectionService {
    private static final Logger log = LoggerFactory.getLogger(JobCollectionService.class);
    private final JobPostingNormalizer normalizer;
    private final JobPostingWriter writer;

    public JobCollectionService(JobPostingNormalizer normalizer, JobPostingWriter writer) {
        this.normalizer = normalizer;
        this.writer = writer;
    }

    // Suspend any caller transaction: provider failure cannot mark CRM work rollback-only.
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public JobCollectionResult collect(JobSourceAdapter adapter, JobSearchCondition condition) {
        Objects.requireNonNull(condition, "Collection condition is required");
        var source = Objects.requireNonNull(adapter.source(), "Source is required");
        List<ExternalJobPosting> response;
        try {
            response = Objects.requireNonNull(adapter.fetchJobs(condition));
        } catch (RuntimeException exception) {
            log.warn("Job collection failed: source={}, reason=SOURCE_FAILED", source.code());
            return new JobCollectionResult(SOURCE_FAILED, 0, 0, 0, 0);
        }
        try {
            writer.registerSource(source);
        } catch (RuntimeException exception) {
            log.warn("Job collection failed: source={}, reason=STORAGE_FAILED", source.code());
            return new JobCollectionResult(STORAGE_FAILED, 0, 0, 0, response.size());
        }
        int created = 0, duplicates = 0, rejected = 0, failed = 0;
        for (var input : response) {
            NormalizedJobPosting normalized;
            try {
                normalized = normalizer.normalize(input);
            } catch (IllegalArgumentException | java.time.DateTimeException exception) {
                rejected++;
                continue;
            }
            try {
                if (writer.store(source.code(), normalized)) {
                    created++;
                } else {
                    duplicates++;
                }
            } catch (RuntimeException exception) {
                failed++;
            }
        }
        var status = rejected == 0 && failed == 0 ? COMPLETED : PARTIAL_FAILURE;
        log.info("Job collection: source={}, status={}, created={}, duplicates={}, rejected={}, failed={}",
                source.code(), status, created, duplicates, rejected, failed);
        return new JobCollectionResult(status, created, duplicates, rejected, failed);
    }
}
