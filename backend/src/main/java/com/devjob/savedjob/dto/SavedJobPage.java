package com.devjob.savedjob.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record SavedJobPage(List<Item> items, int page, int size, long totalElements) {
    public record Item(String kind, Long id, Long jobId, String url, String companyName, String title,
            String role, String careerLevel, String location, String employmentType,
            LocalDate deadlineDate, String note, String description, String source, String applicationStatus,
            String analysisStatus, Instant createdAt) { }
}
