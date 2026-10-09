package com.devjob.coverletter.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.coverletter.dto.*;
import com.devjob.coverletter.service.CoverLetterService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/cover-letters")
public class CoverLetterController {
    private final CoverLetterService service;
    public CoverLetterController(CoverLetterService service) { this.service = service; }
    public record CoverLetterPage(List<CoverLetterResponse> items, int page, int size, long totalElements) { }

    @GetMapping public CoverLetterPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = service.list(user.id(), page, size);
        return new CoverLetterPage(result.getContent(), page, size, result.getTotalElements());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CoverLetterResponse create(@AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode body) {
        return service.create(user.id(), body);
    }
    @GetMapping("/{coverLetterId}") public CoverLetterResponse get(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long coverLetterId) { return service.get(user.id(), coverLetterId); }
    @PatchMapping("/{coverLetterId}") public CoverLetterResponse rename(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long coverLetterId, @RequestBody JsonNode body) { return service.rename(user.id(), coverLetterId, body); }
    @DeleteMapping("/{coverLetterId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long coverLetterId) {
        service.delete(user.id(), coverLetterId);
    }
    @GetMapping("/{coverLetterId}/versions") public List<CoverLetterVersionResponse> versions(
            @AuthenticationPrincipal CurrentUser user, @PathVariable Long coverLetterId) {
        return service.versions(user.id(), coverLetterId);
    }
    @PostMapping("/{coverLetterId}/versions") @ResponseStatus(HttpStatus.CREATED)
    public CoverLetterVersionResponse addVersion(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long coverLetterId, @RequestBody JsonNode body) { return service.addVersion(user.id(), coverLetterId, body); }
    @GetMapping("/{coverLetterId}/versions/{versionId}") public CoverLetterVersionResponse version(
            @AuthenticationPrincipal CurrentUser user, @PathVariable Long coverLetterId, @PathVariable Long versionId) {
        return service.version(user.id(), coverLetterId, versionId);
    }
}
