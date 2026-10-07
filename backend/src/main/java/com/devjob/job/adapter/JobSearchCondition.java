package com.devjob.job.adapter;

/** Internal collection condition, independent of the future public search API. */
public record JobSearchCondition(String keyword, int page, int size, int pages) {
    public JobSearchCondition(String keyword, int page, int size) { this(keyword, page, size, 1); }
    public JobSearchCondition {
        keyword = keyword == null || keyword.isBlank() ? null : keyword.strip();
        if (page < 0 || size < 1 || size > 100 || pages < 1 || pages > 3 || (long) page + pages > 1000) {
            throw new IllegalArgumentException("Invalid collection page");
        }
    }
}
