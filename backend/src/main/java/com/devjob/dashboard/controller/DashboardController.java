package com.devjob.dashboard.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.dashboard.dto.Dashboard;
import com.devjob.dashboard.service.DashboardService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping
    public Dashboard get(@AuthenticationPrincipal CurrentUser user) { return service.get(user.id()); }
}
