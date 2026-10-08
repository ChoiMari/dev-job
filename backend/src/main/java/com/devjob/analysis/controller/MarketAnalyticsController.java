package com.devjob.analysis.controller;

import com.devjob.analysis.dto.MarketAnalyticsQuery;
import com.devjob.analysis.dto.MarketDistribution;
import com.devjob.analysis.dto.SkillTrend;
import com.devjob.analysis.dto.SkillTrendQuery;
import com.devjob.analysis.service.MarketAnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class MarketAnalyticsController {
    private final MarketAnalyticsService service;
    public MarketAnalyticsController(MarketAnalyticsService service) { this.service = service; }
    @GetMapping("/career-levels")
    public MarketDistribution careers(@ModelAttribute MarketAnalyticsQuery query) { return service.careers(query); }
    @GetMapping("/locations")
    public MarketDistribution locations(@ModelAttribute MarketAnalyticsQuery query) { return service.locations(query); }
    @GetMapping("/skills/trends")
    public SkillTrend trends(@ModelAttribute SkillTrendQuery query) { return service.trends(query); }
}
