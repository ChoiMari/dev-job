package com.devjob.todo.service;

import com.devjob.todo.dto.*;
import com.devjob.todo.entity.PersonalTodo;
import com.devjob.todo.repository.PersonalTodoRepository;
import com.devjob.todo.repository.TodoCategoryRepository;
import com.devjob.character.service.CharacterGrowthService;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TodoService {
    private static final Set<String> PATCH_FIELDS = Set.of("title", "description", "dueAt", "dueTimeZone", "category", "reminderMinutes");
    private static final Set<String> CATEGORY_ICONS = Set.of("document", "interview", "study", "growth", "health", "travel", "other",
            "briefcase", "graduation", "dumbbell", "coffee", "home", "gamepad", "sun", "people", "music", "lightbulb", "star",
            "calendar", "flag", "laptop", "leaf", "gift", "trophy", "mail", "camera", "target", "puzzle", "pencil", "clock");
    private static final Set<String> CATEGORY_COLORS = Set.of("blue", "green", "pink", "orange", "yellow", "purple", "sky", "gray");
    private final PersonalTodoRepository todos;
    private final TodoCategoryRepository categories;
    private final UserRepository users;
    private final CharacterGrowthService growth;
    public TodoService(PersonalTodoRepository todos, TodoCategoryRepository categories,
            UserRepository users, CharacterGrowthService growth) {
        this.todos = todos; this.categories = categories; this.users = users; this.growth = growth;
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
        categories.seedDefaults(userId);
        String title = text(input.title(), true, 200);
        String description = text(input.description(), false, 2000);
        Due due = due(input.dueAt(), input.dueTimeZone());
        String category = category(userId, input.category() == null ? defaultCategory(userId) : input.category());
        int reminder = reminder(input.reminderMinutes() == null ? 1440 : input.reminderMinutes());
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return TodoResponse.from(todos.saveAndFlush(new PersonalTodo(user, title, description, due.instant(), due.zone(), category, reminder)));
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
        if (patch.has("category")) categories.seedDefaults(userId);
        String category = patch.has("category") ? category(userId, jsonText(patch.get("category"))) : todo.getCategory();
        int reminder = patch.has("reminderMinutes") ? reminder(jsonInteger(patch.get("reminderMinutes"))) : todo.getReminderMinutes();
        todo.update(title, description, due.instant(), due.zone(), category, reminder);
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

    @Transactional
    public List<TodoCategoryRepository.Category> categories(Long userId) {
        categories.seedDefaults(userId);
        return categories.list(userId);
    }
    @Transactional
    public TodoCategoryRepository.Category createCategory(Long userId, JsonNode input) {
        if (input == null || !input.isObject() || !input.has("name") || input.size() > 3) throw badInput();
        input.fieldNames().forEachRemaining(field -> { if (!Set.of("name", "iconKey", "colorKey").contains(field)) throw badInput(); });
        String name = text(jsonText(input.get("name")), true, 20);
        String iconKey = input.has("iconKey") ? jsonText(input.get("iconKey")) : "other";
        String colorKey = input.has("colorKey") ? jsonText(input.get("colorKey")) : "blue";
        if (iconKey == null || !CATEGORY_ICONS.contains(iconKey)) throw badInput();
        if (colorKey == null || !CATEGORY_COLORS.contains(colorKey)) throw badInput();
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        categories.seedDefaults(userId);
        if (categories.count(userId) >= 20 || categories.exists(userId, name))
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        try { return categories.create(userId, name, iconKey, colorKey); }
        catch (DataIntegrityViolationException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT); }
    }
    @Transactional
    public TodoCategoryRepository.Category updateCategory(Long userId, Long id, JsonNode input) {
        if (id == null || id <= 0 || input == null || !input.isObject() || input.isEmpty()) throw badInput();
        input.fieldNames().forEachRemaining(field -> { if (!Set.of("name", "iconKey", "colorKey").contains(field)) throw badInput(); });
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var old = categories.get(userId, id);
        if (old == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        String name = input.has("name") ? text(jsonText(input.get("name")), true, 20) : old.name();
        String iconKey = input.has("iconKey") ? jsonText(input.get("iconKey")) : old.iconKey();
        String colorKey = input.has("colorKey") ? jsonText(input.get("colorKey")) : old.colorKey();
        if (iconKey == null || !CATEGORY_ICONS.contains(iconKey) || colorKey == null || !CATEGORY_COLORS.contains(colorKey)) throw badInput();
        if (!name.equals(old.name()) && categories.exists(userId, name)) throw new ResponseStatusException(HttpStatus.CONFLICT);
        try {
            var updated = categories.update(userId, id, name, iconKey, colorKey);
            if (!name.equals(old.name())) categories.renameTodos(userId, old.name(), name);
            return updated;
        } catch (DataIntegrityViolationException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT); }
    }
    @Transactional
    public List<TodoCategoryRepository.Category> reorderCategories(Long userId, JsonNode input) {
        if (input == null || !input.isObject() || input.size() != 1 || !input.has("ids") || !input.get("ids").isArray()) throw badInput();
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        List<Long> ids = new ArrayList<>();
        input.get("ids").forEach(node -> {
            if (!node.isIntegralNumber() || !node.canConvertToLong() || node.longValue() <= 0) throw badInput();
            ids.add(node.longValue());
        });
        var current = categories.list(userId);
        if (ids.size() != current.size() || new HashSet<>(ids).size() != ids.size()
                || !new HashSet<>(ids).equals(new HashSet<>(current.stream().map(TodoCategoryRepository.Category::id).toList()))) throw badInput();
        categories.reorder(userId, ids);
        return categories.list(userId);
    }
    @Transactional
    public void deleteCategory(Long userId, Long id) {
        if (id == null || id <= 0) throw badInput();
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var category = categories.get(userId, id);
        if (category == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (categories.count(userId) <= 1 || categories.inUse(userId, category.name())) throw new ResponseStatusException(HttpStatus.CONFLICT);
        categories.delete(userId, id);
    }

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
    private static Integer jsonInteger(JsonNode node) {
        if (!node.isIntegralNumber() || !node.canConvertToInt()) throw badInput();
        return node.intValue();
    }
    private String category(Long userId, String value) {
        String name = text(value, true, 30);
        if (!categories.exists(userId, name)) throw badInput();
        return name;
    }
    private String defaultCategory(Long userId) {
        var list = categories.list(userId);
        return list.stream().anyMatch(item -> item.name().equals("기타")) ? "기타" : list.get(0).name();
    }
    private static int reminder(Integer value) {
        if (value == null || !Set.of(-1, 10, 60, 1440).contains(value)) throw badInput();
        return value;
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
