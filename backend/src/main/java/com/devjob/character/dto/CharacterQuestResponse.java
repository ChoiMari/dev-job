package com.devjob.character.dto;

import java.time.Instant;

public record CharacterQuestResponse(String id, String activityType, long targetCount, long progressCount,
        String rewardItemId, boolean completed, boolean claimed, Instant claimedAt) { }
