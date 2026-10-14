package com.devjob.learninggoal.dto;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record LearningGoalTaskInput(String title, Boolean completed) {
    public static LearningGoalTaskInput from(JsonNode body, boolean create) {
        if (body == null || !body.isObject() || body.isEmpty()) throw invalid();
        body.fieldNames().forEachRemaining(field -> {
            if (!field.equals("title") && !field.equals("completed")) throw invalid();
        });
        if (create && (body.size() != 1 || !body.has("title"))) throw invalid();
        String title = body.has("title") ? LearningGoalInput.title(body.get("title")) : null;
        Boolean completed = null;
        if (body.has("completed")) {
            if (!body.get("completed").isBoolean()) throw invalid();
            completed = body.get("completed").booleanValue();
        }
        return new LearningGoalTaskInput(title, completed);
    }
    private static ResponseStatusException invalid() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
