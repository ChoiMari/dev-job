package com.devjob.auth.dto;

import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public record Credentials(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72) String password) {
    public Credentials {
        if (email != null) email = email.strip().toLowerCase(Locale.ROOT);
    }

    @AssertTrue
    public boolean isPasswordWithinByteLimit() {
        return password == null || password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    @Override
    public String toString() { return "Credentials[redacted]"; }
}
