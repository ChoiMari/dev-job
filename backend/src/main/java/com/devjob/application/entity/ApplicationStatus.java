package com.devjob.application.entity;

import java.util.Set;

public enum ApplicationStatus {
    INTERESTED, PLANNED, APPLIED, DOCUMENT_PASSED, INTERVIEW, FINAL_PASSED, REJECTED, WITHDRAWN;

    public boolean canStart() {
        return Set.of(INTERESTED, PLANNED, APPLIED, DOCUMENT_PASSED, INTERVIEW, FINAL_PASSED, REJECTED, WITHDRAWN).contains(this);
    }
    public boolean canTransitionTo(ApplicationStatus next) {
        return next != null && next != this && next != INTERESTED;
    }
}
