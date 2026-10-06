package com.devjob.analysis.dto;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record SkillDemandQuery(String dateFrom, String dateTo, String desiredRole, Integer page, Integer size) {
    public SkillDemandQuery {
        dateFrom = blankToNull(dateFrom);
        dateTo = blankToNull(dateTo);
        desiredRole = blankToNull(desiredRole);
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
    }

    public void validate() {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE
                || desiredRole != null && desiredRole.length() > 200) invalid();
        LocalDate from = parse(dateFrom);
        LocalDate to = parse(dateTo);
        if (from != null && to != null && from.isAfter(to)) invalid();
    }

    public LocalDate from() { return parse(dateFrom); }
    public LocalDate to() { return parse(dateTo); }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static LocalDate parse(String value) {
        if (value == null) return null;
        if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) invalid();
        try { return LocalDate.parse(value); }
        catch (DateTimeParseException exception) { invalid(); return null; }
    }
    private static void invalid() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
