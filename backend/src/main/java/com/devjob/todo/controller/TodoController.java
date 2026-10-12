package com.devjob.todo.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.todo.dto.*;
import com.devjob.todo.service.TodoService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/todos")
public class TodoController {
    private final TodoService service;
    public TodoController(TodoService service) { this.service = service; }
    public record TodoPage(List<TodoResponse> items, int page, int size, long totalElements) { }
    @GetMapping public TodoPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) Boolean completed,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = service.list(user.id(), completed, page, size);
        return new TodoPage(result.getContent(), page, size, result.getTotalElements());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public TodoResponse create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody TodoInput input) {
        return service.create(user.id(), input);
    }
    @GetMapping("/{todoId}") public TodoResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long todoId) {
        return service.get(user.id(), todoId);
    }
    @PatchMapping("/{todoId}") public TodoResponse update(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long todoId, @RequestBody JsonNode patch) { return service.update(user.id(), todoId, patch); }
    @PatchMapping("/{todoId}/completion") public TodoResponse complete(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long todoId, @Valid @RequestBody TodoCompletionInput input) {
        return service.complete(user.id(), todoId, input.completed());
    }
    @DeleteMapping("/{todoId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long todoId) { service.delete(user.id(), todoId); }
    @GetMapping("/categories")
    public List<com.devjob.todo.repository.TodoCategoryRepository.Category> categories(@AuthenticationPrincipal CurrentUser user) {
        return service.categories(user.id());
    }
    @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
    public com.devjob.todo.repository.TodoCategoryRepository.Category createCategory(
            @AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode input) {
        return service.createCategory(user.id(), input);
    }
    @PatchMapping("/categories/{categoryId}")
    public com.devjob.todo.repository.TodoCategoryRepository.Category updateCategory(
            @AuthenticationPrincipal CurrentUser user, @PathVariable Long categoryId, @RequestBody JsonNode input) {
        return service.updateCategory(user.id(), categoryId, input);
    }
    @PutMapping("/categories/order")
    public List<com.devjob.todo.repository.TodoCategoryRepository.Category> reorderCategories(
            @AuthenticationPrincipal CurrentUser user, @RequestBody JsonNode input) {
        return service.reorderCategories(user.id(), input);
    }
    @DeleteMapping("/categories/{categoryId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@AuthenticationPrincipal CurrentUser user, @PathVariable Long categoryId) {
        service.deleteCategory(user.id(), categoryId);
    }
}
