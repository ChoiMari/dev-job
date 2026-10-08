package com.devjob.job.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.dto.AlioBatchStatus;
import com.devjob.job.service.AlioBatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/jobs/collections/alio")
public class AlioBatchController {
    private final AlioBatchService batch;

    public AlioBatchController(AlioBatchService batch) { this.batch = batch; }

    @PostMapping
    public ResponseEntity<AlioBatchStatus> start(@AuthenticationPrincipal CurrentUser user) {
        return ResponseEntity.accepted().body(batch.start(user));
    }

    @GetMapping
    public AlioBatchStatus status(@AuthenticationPrincipal CurrentUser user) {
        return batch.status(user);
    }
}
