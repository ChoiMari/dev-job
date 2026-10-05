package com.devjob.profile.dto;

import jakarta.validation.constraints.*;
import java.util.Locale;

public record ProfileInput(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 100) String desiredRole,
        @Size(max = 100) String careerLevel,
        @Size(max = 100) String desiredLocation,
        @Size(max = 2000) String introduction,
        @Size(max = 1000) String education,
        @Size(max = 1000) String certifications) {
    public ProfileInput {
        if (email != null) email = email.strip().toLowerCase(Locale.ROOT);
        if (name != null) name = name.strip();
        desiredRole = optional(desiredRole);
        careerLevel = optional(careerLevel);
        desiredLocation = optional(desiredLocation);
        introduction = optional(introduction);
        education = optional(education);
        certifications = optional(certifications);
    }
    private static String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
