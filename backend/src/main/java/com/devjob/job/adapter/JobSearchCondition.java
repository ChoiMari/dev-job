package com.devjob.job.adapter;

/** Internal collection condition, independent of the future public search API. */
public record JobSearchCondition(String keyword, int page, int size) {
    public JobSearchCondition {
        keyword = keyword == null || keyword.isBlank() ? null : keyword.strip();
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Invalid collection page");
        }
    }
}
