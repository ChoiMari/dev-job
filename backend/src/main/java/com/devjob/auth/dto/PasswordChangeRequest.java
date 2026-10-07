package com.devjob.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;

public record PasswordChangeRequest(
        @NotBlank @Size(max = 72) String currentPassword,
        @NotBlank @Size(min = 8, max = 72) String newPassword) {
    @AssertTrue
    public boolean isCurrentPasswordWithinByteLimit() {
        return currentPassword == null || currentPassword.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    @AssertTrue
    public boolean isNewPasswordWithinByteLimit() {
        return newPassword == null || newPassword.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    @Override
    public String toString() { return "PasswordChangeRequest[redacted]"; }
}
