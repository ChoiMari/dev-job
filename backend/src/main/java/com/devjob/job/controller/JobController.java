package com.devjob.job.controller;

import com.devjob.job.dto.*;
import com.devjob.job.service.JobQueryService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs")
public class JobController {
    private final JobQueryService jobs;
    public JobController(JobQueryService jobs) { this.jobs = jobs; }
    @GetMapping
    public JobPage search(@ModelAttribute JobQuery query) { return jobs.search(query); }
    @GetMapping("/{jobId}")
    public JobDetail detail(@PathVariable long jobId) { return jobs.detail(jobId); }
}
