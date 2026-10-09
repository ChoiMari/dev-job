package com.devjob.character.dto;

import com.devjob.character.entity.CharacterActivity;
import java.time.Instant;
import java.util.List;

public record CharacterActivityResponse(Long id, String activityType, Long activityId, int expAmount, Instant earnedAt) {
    public static CharacterActivityResponse from(CharacterActivity value) {
        return new CharacterActivityResponse(value.getId(), value.getActivityType(), value.getActivityId(),
                value.getExpAmount(), value.getEarnedAt());
    }
    public record Page(List<CharacterActivityResponse> items, int page, int size, long totalElements) { }
}
