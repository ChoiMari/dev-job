package com.devjob.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;

public record AccountDeletionRequest(
        @NotBlank @Size(max = 72) String currentPassword,
        @NotBlank String confirmation) {
    @AssertTrue
    public boolean isCurrentPasswordWithinByteLimit() {
        return currentPassword == null || currentPassword.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    @Override
    public String toString() { return "AccountDeletionRequest[redacted]"; }
}
