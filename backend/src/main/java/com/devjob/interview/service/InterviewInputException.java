package com.devjob.interview.service;

/** A safe, field-specific validation message for the interview editor. */
public class InterviewInputException extends RuntimeException {
    public InterviewInputException(String message) { super(message); }
}
