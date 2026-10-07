package com.devjob.savedjob.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.savedjob.dto.*;
import com.devjob.savedjob.service.PersonalSavedJobService;
import com.devjob.savedjob.service.PersonalJobAnalysisService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/saved-jobs")
public class PersonalSavedJobController {
    private final PersonalSavedJobService service;
    private final PersonalJobAnalysisService analyses;
    public PersonalSavedJobController(PersonalSavedJobService service, PersonalJobAnalysisService analyses) {
        this.service = service; this.analyses = analyses;
    }
    @GetMapping
    public SavedJobPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(user.id(), page, size);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public PersonalSavedJobResponse create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody PersonalSavedJobInput input) {
        return service.create(user.id(), input);
    }
    @GetMapping("/{id}")
    public PersonalSavedJobResponse detail(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        return service.detail(user.id(), id);
    }
    @PutMapping("/{id}")
    public PersonalSavedJobResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable long id,
            @Valid @RequestBody PersonalSavedJobInput input) { return service.update(user.id(), id, input); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) { service.delete(user.id(), id); }
    @GetMapping("/{id}/analysis")
    public PersonalJobAnalysisResponse analysis(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        return analyses.get(user.id(), id);
    }
    @PostMapping("/{id}/analysis")
    public PersonalJobAnalysisResponse requestAnalysis(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        return analyses.request(user.id(), id);
    }
}
