package com.devjob.job.adapter.alio;

/** Fixed messages avoid exposing serviceKey from transport exceptions. */
public final class AlioSourceException extends RuntimeException {
    public enum Reason { NOT_CONFIGURED, REQUEST_FAILED, INVALID_RESPONSE, PROVIDER_CONNECTION,
        AUTHENTICATION, APPROVAL, PROVIDER_ERROR }
    private final Reason reason;
    public AlioSourceException(Reason reason) {
        super("ALIO source failed: " + reason);
        this.reason = reason;
    }
    public Reason reason() { return reason; }
}
