package com.devjob.job.dto;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;

/** Stored job filters. */
public record JobQuery(String q, String company, String careerLevel, String location,
        String employmentType, String deadlineBefore, Integer page, Integer size, String sort,
        String skillId, String minMatchRate, String applicationStatus, Boolean itOnly, String source, String role) {
    public JobQuery {
        q = text(q); company = text(company); careerLevel = text(careerLevel);
        location = text(location); employmentType = text(employmentType);
        deadlineBefore = text(deadlineBefore);
        source = text(source);
        role = text(role);
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
        sort = sort == null ? "latest" : sort;
        itOnly = itOnly == null ? false : itOnly;
    }

    public void validate() {
        for (String value : new String[]{q, company, careerLevel, location, employmentType}) {
            if (value != null && value.length() > 200) invalid();
        }
        if (page < 0 || size < 1 || size > 100 || !java.util.Set.of("latest", "deadline", "matchRate").contains(sort)
                || (long) page * size > Integer.MAX_VALUE) invalid();
        if (skillId != null && !skillId.matches("[1-9]\\d*")) invalid();
        if (skillId != null) try { Long.parseLong(skillId); } catch (NumberFormatException exception) { invalid(); }
        if (minMatchRate != null && (!minMatchRate.matches("\\d{1,3}") || Integer.parseInt(minMatchRate) > 100)) invalid();
        if (source != null && (source.length() > 100 || !source.matches("[A-Z][A-Z0-9_]*"))) invalid();
        if (role != null && !com.devjob.job.service.JobRoles.TERMS.containsKey(role)) invalid();
        com.devjob.application.service.ApplicationService.parseStatus(applicationStatus);
        if (deadlineBefore != null) {
            if (!deadlineBefore.matches("\\d{4}-\\d{2}-\\d{2}")) invalid();
            try { LocalDate.parse(deadlineBefore); }
            catch (java.time.format.DateTimeParseException exception) { invalid(); }
        }
    }

    public LocalDate deadline() { return deadlineBefore == null ? null : LocalDate.parse(deadlineBefore); }
    public Long skill() { return skillId == null ? null : Long.parseLong(skillId); }
    public Integer minimumRate() { return minMatchRate == null ? null : Integer.parseInt(minMatchRate); }
    private static String text(String value) {
        if (value == null || value.isBlank()) return null;
        value = value.strip();
        return value;
    }
    private static void invalid() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
