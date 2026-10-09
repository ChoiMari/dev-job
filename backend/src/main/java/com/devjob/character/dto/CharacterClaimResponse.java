package com.devjob.character.dto;

import java.time.Instant;

public record CharacterClaimResponse(String questId, String itemId, Instant claimedAt, CharacterProgress progress) { }
