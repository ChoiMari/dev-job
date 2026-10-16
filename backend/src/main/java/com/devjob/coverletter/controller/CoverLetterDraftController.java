package com.devjob.coverletter.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.coverletter.service.CoverLetterDraftService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/cover-letters/drafts")
public class CoverLetterDraftController {
    private final CoverLetterDraftService service;
    public CoverLetterDraftController(CoverLetterDraftService service) { this.service = service; }

    @GetMapping public List<CoverLetterDraftService.Summary> list(@AuthenticationPrincipal CurrentUser user) {
        return service.list(user.id());
    }
    @GetMapping("/{id}") public CoverLetterDraftService.Detail get(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long id) { return service.get(user.id(), id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CoverLetterDraftService.Summary create(@AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode body) {
        return service.create(user.id(), body);
    }
    @PutMapping("/{id}") public CoverLetterDraftService.Summary save(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long id, @RequestBody JsonNode body) { return service.save(user.id(), id, body); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        service.delete(user.id(), id);
    }
}
