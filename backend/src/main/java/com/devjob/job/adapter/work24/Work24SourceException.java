package com.devjob.job.adapter.work24;

/** Contains no provider text, URI, credentials, or nested transport exception. */
public final class Work24SourceException extends RuntimeException {
    public enum Reason { NOT_CONFIGURED, REQUEST_FAILED, INVALID_RESPONSE }
    private final Reason reason;

    public Work24SourceException(Reason reason) {
        super("Work24 source failed: " + reason);
        this.reason = reason;
    }

    public Reason reason() { return reason; }
}
