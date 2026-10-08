package com.devjob.analysis.dto;

import java.time.temporal.ChronoUnit;

public record SkillTrendQuery(String dateFrom, String dateTo, String source, String desiredRole,
                              Long skillId, Interval interval) {
    public enum Interval { WEEK, MONTH }
    public SkillTrendQuery {
        interval = interval == null ? Interval.MONTH : interval;
    }
    public MarketAnalyticsQuery market() {
        var query = new MarketAnalyticsQuery(dateFrom, dateTo, source, desiredRole);
        query.validate();
        if (query.from() == null || query.to() == null || skillId == null || skillId <= 0) MarketAnalyticsQuery.invalid();
        if (ChronoUnit.DAYS.between(query.from(), query.to()) > 1830) MarketAnalyticsQuery.invalid();
        return query;
    }
}
