package com.devjob.application.controller;

import com.devjob.application.dto.*;
import com.devjob.application.service.ApplicationService;
import com.devjob.auth.dto.CurrentUser;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/applications")
public class ApplicationController {
    private final ApplicationService applications;
    public ApplicationController(ApplicationService applications) { this.applications = applications; }
    @GetMapping
    public ApplicationResponse.Page list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return applications.list(user.id(), status, page, size);
    }
    @PostMapping
    public ResponseEntity<ApplicationResponse> create(@AuthenticationPrincipal CurrentUser user, @RequestBody ApplicationInput.Create input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(applications.create(user.id(), input));
    }
    @GetMapping("/{applicationId}")
    public ApplicationResponse detail(@AuthenticationPrincipal CurrentUser user, @PathVariable long applicationId) {
        return applications.detail(user.id(), applicationId);
    }
    @GetMapping("/by-job/{jobId}")
    public ApplicationResponse forJob(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) {
        return applications.forJob(user.id(), jobId);
    }
    @PatchMapping("/{applicationId}")
    public ApplicationResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable long applicationId, @RequestBody ApplicationInput.Update input) {
        return applications.update(user.id(), applicationId, input);
    }
    @PatchMapping("/{applicationId}/status")
    public ApplicationResponse status(@AuthenticationPrincipal CurrentUser user, @PathVariable long applicationId, @RequestBody ApplicationInput.ChangeStatus input) {
        return applications.changeStatus(user.id(), applicationId, input);
    }
    @GetMapping("/{applicationId}/history")
    public List<ApplicationResponse.History> history(@AuthenticationPrincipal CurrentUser user, @PathVariable long applicationId) {
        return applications.history(user.id(), applicationId);
    }
    @DeleteMapping("/{applicationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long applicationId) {
        applications.delete(user.id(), applicationId);
    }
}
