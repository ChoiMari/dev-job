package com.devjob.resume.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.resume.dto.*;
import com.devjob.resume.service.ResumeService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/resumes")
public class ResumeController {
    private final ResumeService service;
    public ResumeController(ResumeService service) { this.service = service; }
    public record ResumePage(List<ResumeResponse> items, int page, int size, long totalElements) { }

    @GetMapping public ResumePage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = service.list(user.id(), page, size);
        return new ResumePage(result.getContent(), page, size, result.getTotalElements());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ResumeResponse create(@AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode body) {
        return service.create(user.id(), body);
    }
    @GetMapping("/{resumeId}") public ResumeResponse get(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long resumeId) { return service.get(user.id(), resumeId); }
    @PatchMapping("/{resumeId}") public ResumeResponse rename(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long resumeId, @RequestBody JsonNode body) { return service.rename(user.id(), resumeId, body); }
    @DeleteMapping("/{resumeId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long resumeId) {
        service.delete(user.id(), resumeId);
    }
    @GetMapping("/{resumeId}/versions") public List<ResumeVersionResponse> versions(
            @AuthenticationPrincipal CurrentUser user, @PathVariable Long resumeId) {
        return service.versions(user.id(), resumeId);
    }
    @PostMapping("/{resumeId}/versions") @ResponseStatus(HttpStatus.CREATED)
    public ResumeVersionResponse addVersion(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long resumeId, @RequestBody JsonNode body) { return service.addVersion(user.id(), resumeId, body); }
    @GetMapping("/{resumeId}/versions/{versionId}") public ResumeVersionResponse version(
            @AuthenticationPrincipal CurrentUser user, @PathVariable Long resumeId, @PathVariable Long versionId) {
        return service.version(user.id(), resumeId, versionId);
    }
    @PatchMapping("/{resumeId}/versions/{versionId}") public ResumeVersionResponse editVersion(
            @AuthenticationPrincipal CurrentUser user, @PathVariable Long resumeId, @PathVariable Long versionId,
            @RequestBody JsonNode body) {
        return service.editVersion(user.id(), resumeId, versionId, body);
    }
    @DeleteMapping("/{resumeId}/versions/{versionId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVersion(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long resumeId, @PathVariable Long versionId) {
        service.deleteVersion(user.id(), resumeId, versionId);
    }
}
