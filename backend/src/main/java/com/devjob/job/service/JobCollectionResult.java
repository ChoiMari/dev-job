package com.devjob.job.service;

/** Internal outcome only; no provider payload or exception message is retained. */
public record JobCollectionResult(
        Status status, int created, int duplicates, int rejected, int failed) {
    public enum Status { COMPLETED, PARTIAL_FAILURE, SOURCE_FAILED, STORAGE_FAILED }
}
