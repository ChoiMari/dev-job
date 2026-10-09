package com.devjob.todo.service;

import com.devjob.todo.dto.*;
import com.devjob.todo.entity.PersonalTodo;
import com.devjob.todo.repository.PersonalTodoRepository;
import com.devjob.character.service.CharacterGrowthService;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.Set;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TodoService {
    private static final Set<String> PATCH_FIELDS = Set.of("title", "description", "dueAt", "dueTimeZone");
    private final PersonalTodoRepository todos;
    private final UserRepository users;
    private final CharacterGrowthService growth;
    public TodoService(PersonalTodoRepository todos, UserRepository users, CharacterGrowthService growth) {
        this.todos = todos; this.users = users; this.growth = growth;
    }

    @Transactional(readOnly = true)
    public Page<TodoResponse> list(Long userId, Boolean completed, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        return todos.list(userId, completed, PageRequest.of(page, size)).map(TodoResponse::from);
    }
    @Transactional(readOnly = true)
    public TodoResponse get(Long userId, Long id) { return TodoResponse.from(owned(userId, id, false)); }
    @Transactional
    public TodoResponse create(Long userId, TodoInput input) {
        String title = text(input.title(), true, 200);
        String description = text(input.description(), false, 2000);
        Due due = due(input.dueAt(), input.dueTimeZone());
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return TodoResponse.from(todos.saveAndFlush(new PersonalTodo(user, title, description, due.instant(), due.zone())));
    }
    @Transactional
    public TodoResponse update(Long userId, Long id, JsonNode patch) {
        if (patch == null || !patch.isObject() || patch.isEmpty()) throw badInput();
        patch.fieldNames().forEachRemaining(name -> { if (!PATCH_FIELDS.contains(name)) throw badInput(); });
        var todo = owned(userId, id, true);
        String title = patch.has("title") ? text(jsonText(patch.get("title")), true, 200) : todo.getTitle();
        String description = patch.has("description") ? text(jsonText(patch.get("description")), false, 2000) : todo.getDescription();
        OffsetDateTime at = patch.has("dueAt") ? jsonDate(patch.get("dueAt"))
                : todo.getDueAt() == null ? null : todo.getDueAt().atZone(ZoneId.of(todo.getDueTimeZone())).toOffsetDateTime();
        String zone = patch.has("dueTimeZone") ? jsonText(patch.get("dueTimeZone")) : todo.getDueTimeZone();
        Due due = due(at, zone);
        todo.update(title, description, due.instant(), due.zone());
        todos.flush();
        return TodoResponse.from(todo);
    }
    @Transactional
    public TodoResponse complete(Long userId, Long id, boolean completed) {
        var todo = owned(userId, id, true);
        boolean firstCompletion = completed && todo.getCompletedAt() == null;
        todo.setCompleted(completed);
        todos.flush();
        if (firstCompletion) growth.awardTodoCompletion(todo);
        return TodoResponse.from(todo);
    }
    @Transactional
    public void delete(Long userId, Long id) { owned(userId, id, true).delete(); todos.flush(); }

    private PersonalTodo owned(Long userId, Long id, boolean lock) {
        if (id == null || id <= 0) throw badInput();
        var todo = (lock ? todos.findForUpdate(id) : todos.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (todo.getDeletedAt() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!todo.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return todo;
    }
    private static String jsonText(JsonNode node) {
        if (node.isNull()) return null;
        if (!node.isTextual()) throw badInput();
        return node.textValue();
    }
    private static OffsetDateTime jsonDate(JsonNode node) {
        if (node.isNull()) return null;
        if (!node.isTextual()) throw badInput();
        try { return OffsetDateTime.parse(node.textValue()); }
        catch (DateTimeException exception) { throw badInput(); }
    }
    private static String text(String value, boolean required, int max) {
        if (value == null) { if (required) throw badInput(); return null; }
        String normalized = value.strip();
        if (normalized.isEmpty()) { if (required) throw badInput(); return null; }
        if (normalized.length() > max || normalized.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) throw badInput();
        return normalized;
    }
    private static Due due(OffsetDateTime at, String timeZone) {
        if (at == null && timeZone == null) return new Due(null, null);
        if (at == null || timeZone == null) throw badInput();
        String zoneName = text(timeZone, true, 100);
        try {
            ZoneId zone = ZoneId.of(zoneName);
            if (!ZoneId.getAvailableZoneIds().contains(zoneName)) throw badInput();
            Instant instant = at.toInstant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
            if (!zone.getRules().getOffset(instant).equals(at.getOffset())) throw badInput();
            return new Due(instant, zone.getId());
        } catch (DateTimeException exception) { throw badInput(); }
    }
    private record Due(Instant instant, String zone) { }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
