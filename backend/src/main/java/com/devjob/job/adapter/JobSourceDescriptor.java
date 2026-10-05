package com.devjob.job.adapter;

import java.util.Locale;

public record JobSourceDescriptor(String code, String name) {
    public JobSourceDescriptor {
        if (code == null || name == null || name.isBlank()) {
            throw new IllegalArgumentException("Source code and name are required");
        }
        code = code.strip().toUpperCase(Locale.ROOT);
        name = name.strip();
        if (!code.matches("[A-Z][A-Z0-9_]*")) {
            throw new IllegalArgumentException("Invalid source code");
        }
    }
}
