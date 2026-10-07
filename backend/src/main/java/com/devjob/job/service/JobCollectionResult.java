package com.devjob.job.service;

/** Internal outcome only; no provider payload or exception message is retained. */
public record JobCollectionResult(
        Status status, int created, int duplicates, int rejected, int failed, String sourceError) {
    public JobCollectionResult(Status status, int created, int duplicates, int rejected, int failed) {
        this(status, created, duplicates, rejected, failed, null);
    }
    public enum Status { COMPLETED, PARTIAL_FAILURE, SOURCE_FAILED, STORAGE_FAILED }
}
