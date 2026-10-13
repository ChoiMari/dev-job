package com.devjob.analysis.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MarketAnalyticsCareerTest {
    @Test void classifiesOnlyClearCareerBands() {
        assertThat(MarketAnalyticsService.career("신입")).isEqualTo("ENTRY");
        assertThat(MarketAnalyticsService.career("경력 1~3년")).isEqualTo("JUNIOR");
        assertThat(MarketAnalyticsService.career("경력 3년")).isEqualTo("JUNIOR");
        assertThat(MarketAnalyticsService.career("경력 4년")).isEqualTo("MIDDLE");
        assertThat(MarketAnalyticsService.career("4년~7년")).isEqualTo("MIDDLE");
        assertThat(MarketAnalyticsService.career("경력 8년")).isEqualTo("SENIOR");
        assertThat(MarketAnalyticsService.career("8년 이상")).isEqualTo("SENIOR");
    }

    @Test void keepsAmbiguousOrMissingYearsOutOfTheFourBands() {
        assertThat(MarketAnalyticsService.career("경력")).isEqualTo("UNCLASSIFIED");
        assertThat(MarketAnalyticsService.career("경력 무관")).isEqualTo("UNCLASSIFIED");
        assertThat(MarketAnalyticsService.career("신입/경력")).isEqualTo("UNCLASSIFIED");
        assertThat(MarketAnalyticsService.career("경력 3~5년")).isEqualTo("UNCLASSIFIED");
        assertThat(MarketAnalyticsService.career("경력 5년 이상")).isEqualTo("UNCLASSIFIED");
        assertThat(MarketAnalyticsService.career("경력 3년 이하")).isEqualTo("UNCLASSIFIED");
        assertThat(MarketAnalyticsService.career(null)).isEqualTo("UNCLASSIFIED");
    }
}
