package com.devjob.analysis.dto;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record MarketAnalyticsQuery(String dateFrom, String dateTo, String source, String desiredRole) {
    public MarketAnalyticsQuery {
        dateFrom = trim(dateFrom);
        dateTo = trim(dateTo);
        source = trim(source);
        desiredRole = trim(desiredRole);
    }

    public void validate() {
        if (source != null && !source.matches("[A-Z0-9_]{1,100}")
                || desiredRole != null && desiredRole.length() > 200) invalid();
        if (from() != null && to() != null && from().isAfter(to())) invalid();
    }

    public LocalDate from() { return date(dateFrom); }
    public LocalDate to() { return date(dateTo); }

    private static String trim(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static LocalDate date(String value) {
        if (value == null) return null;
        if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) invalid();
        try { return LocalDate.parse(value); }
        catch (DateTimeParseException exception) { invalid(); return null; }
    }
    static void invalid() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
