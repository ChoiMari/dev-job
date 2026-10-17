package com.devjob.analysis.controller;

import com.devjob.analysis.dto.PersonalJobAnalytics;
import com.devjob.analysis.service.PersonalJobAnalyticsService;
import com.devjob.auth.dto.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/job-analytics")
public class PersonalJobAnalyticsController {
    private final PersonalJobAnalyticsService service;

    public PersonalJobAnalyticsController(PersonalJobAnalyticsService service) { this.service = service; }

    @GetMapping
    public PersonalJobAnalytics get(@AuthenticationPrincipal CurrentUser user) {
        return service.find(user.id());
    }
}
