package com.devjob.interview.service;

import com.devjob.application.entity.Application;
import com.devjob.application.repository.ApplicationRepository;
import com.devjob.interview.dto.InterviewResponse;
import com.devjob.interview.entity.InterviewSchedule;
import com.devjob.interview.repository.InterviewScheduleRepository;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InterviewService {
    private static final Set<String> FIELDS = Set.of("applicationId", "title", "startsAt", "timeZone", "stage", "interviewMethod", "memo");
    private static final Set<String> STAGES = Set.of("FIRST", "SECOND", "FINAL", "OTHER");
    private static final Set<String> METHODS = Set.of("IN_PERSON", "ONLINE", "PHONE");
    private final InterviewScheduleRepository interviews;
    private final ApplicationRepository applications;
    private final UserRepository users;

    public InterviewService(InterviewScheduleRepository interviews, ApplicationRepository applications, UserRepository users) {
        this.interviews = interviews;
        this.applications = applications;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Page<InterviewResponse> list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        return interviews.findByUserId(userId, PageRequest.of(page, size,
                Sort.by(Sort.Order.asc("startsAt"), Sort.Order.desc("id")))).map(InterviewResponse::from);
    }

    @Transactional(readOnly = true)
    public InterviewResponse get(Long userId, Long id) { return InterviewResponse.from(owned(userId, id, false)); }

    @Transactional
    public InterviewResponse create(Long userId, JsonNode input) {
        fields(input);
        String title = title(input.get("title"));
        Schedule schedule = schedule(input.get("startsAt"), input.get("timeZone"));
        Application application = application(userId, input.get("applicationId"));
        String stage = choice(input.get("stage"), STAGES);
        String interviewMethod = choice(input.get("interviewMethod"), METHODS);
        String memo = memo(input.get("memo"));
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return InterviewResponse.from(interviews.saveAndFlush(
                new InterviewSchedule(user, application, title, schedule.instant(), schedule.zone(), stage, interviewMethod, memo)));
    }

    @Transactional
    public InterviewResponse update(Long userId, Long id, JsonNode input) {
        fields(input);
        if (input.isEmpty()) throw badInput();
        // Require both time fields in a time change so the requested wall time and zone are unambiguous.
        if (input.has("startsAt") != input.has("timeZone")) throw badInput();
        var interview = owned(userId, id, true);
        String title = input.has("title") ? title(input.get("title")) : interview.getTitle();
        Schedule schedule = input.has("startsAt") ? schedule(input.get("startsAt"), input.get("timeZone"))
                : new Schedule(interview.getStartsAt(), interview.getTimeZone());
        Application application = input.has("applicationId") ? application(userId, input.get("applicationId"))
                : interview.getApplication();
        String stage = input.has("stage") ? choice(input.get("stage"), STAGES) : interview.getStage();
        String interviewMethod = input.has("interviewMethod") ? choice(input.get("interviewMethod"), METHODS) : interview.getInterviewMethod();
        String memo = input.has("memo") ? memo(input.get("memo")) : interview.getMemo();
        interview.update(application, title, schedule.instant(), schedule.zone(), stage, interviewMethod, memo);
        interviews.flush();
        return InterviewResponse.from(interview);
    }

    @Transactional
    public InterviewResponse setCancelled(Long userId, Long id, boolean cancelled) {
        var interview = owned(userId, id, true);
        interview.setCancelled(cancelled);
        interviews.flush();
        return InterviewResponse.from(interview);
    }

    private InterviewSchedule owned(Long userId, Long id, boolean lock) {
        if (id == null || id < 1) throw badInput();
        var interview = (lock ? interviews.findForUpdate(id) : interviews.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!interview.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return interview;
    }

    private Application application(Long userId, JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (!value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 1) throw badInput();
        var application = applications.findById(value.longValue())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!application.getUser().getId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return application;
    }

    private static void fields(JsonNode input) {
        if (input == null || !input.isObject()) throw badInput();
        input.fieldNames().forEachRemaining(field -> { if (!FIELDS.contains(field)) throw badInput(); });
    }
    private static String title(JsonNode value) {
        if (value == null || !value.isTextual()) throw badInput();
        String title = value.textValue().strip();
        if (title.isEmpty() || title.length() > 200 || title.codePoints().anyMatch(c -> Character.isISOControl(c))) throw badInput();
        return title;
    }
    private static String choice(JsonNode value, Set<String> allowed) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual() || !allowed.contains(value.textValue())) throw badInput();
        return value.textValue();
    }
    private static String memo(JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) throw badInput();
        String text = value.textValue().strip();
        if (text.length() > 500 || text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) throw badInput();
        return text.isEmpty() ? null : text;
    }
    private static Schedule schedule(JsonNode at, JsonNode zoneValue) {
        if (at == null || !at.isTextual() || zoneValue == null || !zoneValue.isTextual()) throw badInput();
        String zoneName = zoneValue.textValue();
        if (zoneName.isBlank() || zoneName.length() > 100 || !ZoneId.getAvailableZoneIds().contains(zoneName)) throw badInput();
        try {
            OffsetDateTime date = OffsetDateTime.parse(at.textValue());
            if (date.getYear() < 1 || date.getYear() > 9999) throw badInput();
            Instant instant = date.toInstant();
            if (!ZoneId.of(zoneName).getRules().getOffset(instant).equals(date.getOffset())) throw badInput();
            return new Schedule(instant.truncatedTo(ChronoUnit.MICROS), zoneName);
        } catch (DateTimeException exception) { throw badInput(); }
    }
    private record Schedule(Instant instant, String zone) { }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
