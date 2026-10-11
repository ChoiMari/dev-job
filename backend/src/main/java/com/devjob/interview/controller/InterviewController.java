package com.devjob.interview.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.interview.dto.InterviewResponse;
import com.devjob.interview.service.InterviewService;
import com.devjob.interview.service.InterviewInputException;
import com.devjob.common.error.ApiError;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/interviews")
public class InterviewController {
    private final InterviewService service;
    public InterviewController(InterviewService service) { this.service = service; }

    @ExceptionHandler(InterviewInputException.class)
    public ResponseEntity<ApiError> invalidInterviewInput(InterviewInputException exception) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_INPUT", exception.getMessage()));
    }
    public record InterviewPage(List<InterviewResponse> items, int page, int size, long totalElements) { }
    @GetMapping public InterviewPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = service.list(user.id(), page, size);
        return new InterviewPage(result.getContent(), page, size, result.getTotalElements());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public InterviewResponse create(@AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode input) {
        return service.create(user.id(), input);
    }
    @GetMapping("/{interviewId}") public InterviewResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long interviewId) {
        return service.get(user.id(), interviewId);
    }
    @PatchMapping("/{interviewId}") public InterviewResponse update(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long interviewId, @RequestBody JsonNode input) { return service.update(user.id(), interviewId, input); }
    @PostMapping("/{interviewId}/cancel") public InterviewResponse cancel(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long interviewId) { return service.setCancelled(user.id(), interviewId, true); }
    @PostMapping("/{interviewId}/complete") public InterviewResponse complete(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long interviewId) { return service.setCompleted(user.id(), interviewId); }
    @PostMapping("/{interviewId}/reactivate") public InterviewResponse reactivate(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long interviewId) { return service.setCancelled(user.id(), interviewId, false); }
}
