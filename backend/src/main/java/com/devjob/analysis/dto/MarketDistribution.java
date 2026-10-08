package com.devjob.analysis.dto;

import java.util.List;

public record MarketDistribution(long jobCount, boolean insufficientSample, List<Bucket> buckets) {
    public record Bucket(String key, long jobCount, double ratio) { }
}
