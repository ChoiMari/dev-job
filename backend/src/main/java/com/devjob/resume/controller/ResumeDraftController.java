package com.devjob.resume.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.resume.service.ResumeDraftService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/resumes/drafts")
public class ResumeDraftController {
    private final ResumeDraftService service;
    public ResumeDraftController(ResumeDraftService service) { this.service = service; }

    @GetMapping public JsonNode list(@AuthenticationPrincipal CurrentUser user) { return service.list(user.id()); }
    @GetMapping("/{id}") public JsonNode get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        return service.get(user.id(), id);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode body) {
        return service.create(user.id(), body);
    }
    @PutMapping("/{id}") public JsonNode save(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
            @RequestBody JsonNode body) {
        return service.save(user.id(), id, body);
    }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) { service.delete(user.id(), id); }
}
