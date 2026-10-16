package com.devjob.project.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.project.dto.*;
import com.devjob.project.entity.ProjectType;
import com.devjob.project.service.ProjectService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/projects")
public class ProjectController {
    private final ProjectService projects;
    public ProjectController(ProjectService projects) { this.projects = projects; }
    public record ProjectPage(List<ProjectResponse> items, int page, int size, long totalElements) { }
    @GetMapping public ProjectPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q, @RequestParam(required = false) ProjectType projectType,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "NEWEST") String sort) {
        var result = projects.list(user.id(), page, size, q, projectType, status, sort);
        return new ProjectPage(result.getContent(), page, size, result.getTotalElements());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody ProjectInput input) {
        return projects.create(user.id(), input);
    }
    @GetMapping("/{projectId}") public ProjectResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long projectId) {
        return projects.get(user.id(), projectId);
    }
    @PutMapping("/{projectId}") public ProjectResponse update(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long projectId, @Valid @RequestBody ProjectInput input) { return projects.update(user.id(), projectId, input); }
    @DeleteMapping("/{projectId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long projectId) { projects.delete(user.id(), projectId); }
}
