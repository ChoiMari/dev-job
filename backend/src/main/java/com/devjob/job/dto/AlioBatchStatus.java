package com.devjob.job.dto;

import java.time.Instant;
import java.util.UUID;

public record AlioBatchStatus(UUID runId, String status, Instant startedAt, Instant updatedAt,
        Instant finishedAt, int processedPages, int created, int duplicates, int rejected,
        int failed, String sourceError) {
    public static AlioBatchStatus idle() {
        return new AlioBatchStatus(null, "IDLE", null, null, null, 0, 0, 0, 0, 0, null);
    }
}
