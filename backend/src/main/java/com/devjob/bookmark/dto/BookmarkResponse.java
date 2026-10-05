package com.devjob.bookmark.dto;

import com.devjob.bookmark.entity.Bookmark;
import com.devjob.job.dto.JobSummary;
import java.time.Instant;

public record BookmarkResponse(Long id, JobSummary job, Instant createdAt) {
    public static BookmarkResponse from(Bookmark bookmark) {
        return new BookmarkResponse(bookmark.getId(), JobSummary.from(bookmark.getJob(), true), bookmark.getCreatedAt());
    }
}
