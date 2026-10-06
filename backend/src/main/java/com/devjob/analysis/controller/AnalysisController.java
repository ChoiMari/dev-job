package com.devjob.analysis.controller;

import com.devjob.analysis.dto.AnalysisResponse;
import com.devjob.analysis.service.AnalysisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs/{jobId}/analysis")
public class AnalysisController {
    private final AnalysisService service;
    public AnalysisController(AnalysisService service) { this.service = service; }
    @PostMapping
    public ResponseEntity<AnalysisResponse> request(@PathVariable long jobId) {
        var result = service.request(jobId);
        return ResponseEntity.status(result.accepted() ? 202 : 200).body(result.body());
    }
    @GetMapping
    public AnalysisResponse get(@PathVariable long jobId) { return service.get(jobId); }
}
