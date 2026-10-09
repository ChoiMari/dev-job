package com.devjob.auth.dto;

import java.util.List;

public record DeletionImpactResponse(
        List<Resource> deletedResources,
        List<String> preservedSharedResources,
        String confirmationText,
        boolean recoverableInApp,
        String processing,
        String externalDataNotice) {
    public record Resource(String code, String name, long count) { }
}
