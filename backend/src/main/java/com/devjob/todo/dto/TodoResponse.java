package com.devjob.todo.dto;

import com.devjob.todo.entity.PersonalTodo;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;

public record TodoResponse(Long id, String title, String description, OffsetDateTime dueAt, String dueTimeZone,
        String category, int reminderMinutes, boolean completed, Instant completedAt, Instant createdAt, Instant updatedAt) {
    public static TodoResponse from(PersonalTodo todo) {
        var zone = todo.getDueTimeZone();
        return new TodoResponse(todo.getId(), todo.getTitle(), todo.getDescription(),
                todo.getDueAt() == null ? null : todo.getDueAt().atZone(ZoneId.of(zone)).toOffsetDateTime(),
                zone, todo.getCategory(), todo.getReminderMinutes(), todo.getCompletedAt() != null,
                todo.getCompletedAt(), todo.getCreatedAt(), todo.getUpdatedAt());
    }
}
