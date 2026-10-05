package com.devjob.job.controller;

import com.devjob.job.dto.*;
import com.devjob.job.service.JobQueryService;
import com.devjob.auth.dto.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs")
public class JobController {
    private final JobQueryService jobs;
    public JobController(JobQueryService jobs) { this.jobs = jobs; }
    @GetMapping
    public JobPage search(@AuthenticationPrincipal CurrentUser user, @ModelAttribute JobQuery query) { return jobs.search(user.id(), query); }
    @GetMapping("/{jobId}")
    public JobDetail detail(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) { return jobs.detail(user.id(), jobId); }
}
