package com.devjob.application.entity;

import java.util.Set;

public enum ApplicationStatus {
    INTERESTED, PLANNED, APPLIED, DOCUMENT_PASSED, INTERVIEW, FINAL_PASSED, REJECTED, WITHDRAWN;

    public boolean canStart() { return Set.of(INTERESTED, PLANNED, APPLIED).contains(this); }
    public boolean canTransitionTo(ApplicationStatus next) {
        return switch (this) {
            case INTERESTED -> Set.of(PLANNED, WITHDRAWN).contains(next);
            case PLANNED -> Set.of(APPLIED, WITHDRAWN).contains(next);
            case APPLIED -> Set.of(DOCUMENT_PASSED, REJECTED, WITHDRAWN).contains(next);
            case DOCUMENT_PASSED -> Set.of(INTERVIEW, REJECTED).contains(next);
            case INTERVIEW -> Set.of(FINAL_PASSED, REJECTED).contains(next);
            default -> false;
        };
    }
}
