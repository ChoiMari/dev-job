package com.devjob.learninggoal.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.learninggoal.dto.LearningGoalInput;
import com.devjob.learninggoal.dto.LearningGoalResponse;
import com.devjob.learninggoal.dto.LearningGoalTaskInput;
import com.devjob.learninggoal.dto.LearningGoalTaskResponse;
import com.devjob.learninggoal.service.LearningGoalService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/me/learning-goals")
public class LearningGoalController {
    private final LearningGoalService service;
    public LearningGoalController(LearningGoalService service) { this.service = service; }
    public record LearningGoalPage(List<LearningGoalResponse> items, int page, int size, long totalElements) { }

    @GetMapping
    public LearningGoalPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) String completed,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        Boolean filter = null;
        if (completed != null) {
            if (!completed.equals("true") && !completed.equals("false"))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            filter = Boolean.valueOf(completed);
        }
        var result = service.list(user.id(), filter, page, size);
        return new LearningGoalPage(result.getContent(), page, size, result.getTotalElements());
    }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public LearningGoalResponse create(@AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode body) {
        var input = LearningGoalInput.from(body, true);
        try { return service.create(user.id(), input); }
        catch (DataIntegrityViolationException exception) { throw duplicateOrOriginal(exception); }
    }

    @GetMapping("/{goalId}")
    public LearningGoalResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long goalId) {
        return service.get(user.id(), goalId);
    }

    @PatchMapping("/{goalId}")
    public LearningGoalResponse update(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long goalId, @RequestBody JsonNode body) {
        var input = LearningGoalInput.from(body, false);
        try { return service.update(user.id(), goalId, input); }
        catch (DataIntegrityViolationException exception) { throw duplicateOrOriginal(exception); }
    }

    @PatchMapping("/{goalId}/completion")
    public LearningGoalResponse complete(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long goalId, @RequestBody JsonNode body) {
        return service.complete(user.id(), goalId, LearningGoalInput.completion(body));
    }

    @DeleteMapping("/{goalId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long goalId) {
        service.delete(user.id(), goalId);
    }

    @GetMapping("/{goalId}/tasks")
    public List<LearningGoalTaskResponse> tasks(@AuthenticationPrincipal CurrentUser user, @PathVariable Long goalId) {
        return service.listTasks(user.id(), goalId);
    }

    @PostMapping("/{goalId}/tasks") @ResponseStatus(HttpStatus.CREATED)
    public LearningGoalTaskResponse addTask(@AuthenticationPrincipal CurrentUser user, @PathVariable Long goalId,
            @RequestBody JsonNode body) {
        return service.addTask(user.id(), goalId, LearningGoalTaskInput.from(body, true));
    }

    @PatchMapping("/{goalId}/tasks/{taskId}")
    public LearningGoalTaskResponse updateTask(@AuthenticationPrincipal CurrentUser user, @PathVariable Long goalId,
            @PathVariable Long taskId, @RequestBody JsonNode body) {
        return service.updateTask(user.id(), goalId, taskId, LearningGoalTaskInput.from(body, false));
    }

    @DeleteMapping("/{goalId}/tasks/{taskId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(@AuthenticationPrincipal CurrentUser user, @PathVariable Long goalId, @PathVariable Long taskId) {
        service.deleteTask(user.id(), goalId, taskId);
    }

    private static RuntimeException duplicateOrOriginal(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null && cause.getMessage().contains("uq_learning_goal_active_identity"))
                return new ResponseStatusException(HttpStatus.CONFLICT);
        }
        return exception;
    }
}
