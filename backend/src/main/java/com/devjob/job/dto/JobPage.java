package com.devjob.job.dto;

import java.util.List;
public record JobPage(List<JobSummary> items, int page, int size, long totalElements) { }
