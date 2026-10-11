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
        String stage = choice(input.get("stage"), STAGES, "면접 단계를 다시 선택해 주세요.");
        String interviewMethod = choice(input.get("interviewMethod"), METHODS, "면접 방식을 다시 선택해 주세요.");
        String memo = memo(input.get("memo"));
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return InterviewResponse.from(interviews.saveAndFlush(
                new InterviewSchedule(user, application, title, schedule.instant(), schedule.zone(), stage, interviewMethod, memo)));
    }

    @Transactional
    public InterviewResponse update(Long userId, Long id, JsonNode input) {
        fields(input);
        if (input.isEmpty()) throw invalid("변경할 면접 정보를 입력해 주세요.");
        // Require both time fields in a time change so the requested wall time and zone are unambiguous.
        if (input.has("startsAt") != input.has("timeZone")) throw invalid("면접 날짜와 시간을 함께 입력해 주세요.");
        var interview = owned(userId, id, true);
        String title = input.has("title") ? title(input.get("title")) : interview.getTitle();
        Schedule schedule = input.has("startsAt") ? schedule(input.get("startsAt"), input.get("timeZone"))
                : new Schedule(interview.getStartsAt(), interview.getTimeZone());
        Application application = input.has("applicationId") ? application(userId, input.get("applicationId"))
                : interview.getApplication();
        String stage = input.has("stage") ? choice(input.get("stage"), STAGES, "면접 단계를 다시 선택해 주세요.") : interview.getStage();
        String interviewMethod = input.has("interviewMethod") ? choice(input.get("interviewMethod"), METHODS, "면접 방식을 다시 선택해 주세요.") : interview.getInterviewMethod();
        String memo = input.has("memo") ? memo(input.get("memo")) : interview.getMemo();
        interview.update(application, title, schedule.instant(), schedule.zone(), stage, interviewMethod, memo);
        interviews.flush();
        return InterviewResponse.from(interview);
    }

    @Transactional
    public InterviewResponse setCancelled(Long userId, Long id, boolean cancelled) {
        var interview = owned(userId, id, true);
        if (cancelled && interview.getCompletedAt() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "완료된 면접은 먼저 예정 상태로 되돌려 주세요.");
        interview.setCancelled(cancelled);
        if (!cancelled) interview.setCompleted(false);
        interviews.flush();
        return InterviewResponse.from(interview);
    }

    @Transactional
    public InterviewResponse setCompleted(Long userId, Long id) {
        var interview = owned(userId, id, true);
        if (interview.getCancelledAt() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "취소된 면접은 먼저 예정 상태로 되돌려 주세요.");
        interview.setCompleted(true);
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
        if (!value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 1) throw invalid("연결된 지원 이력을 다시 선택해 주세요.");
        var application = applications.findById(value.longValue())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!application.getUser().getId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return application;
    }

    private static void fields(JsonNode input) {
        if (input == null || !input.isObject()) throw invalid("면접 입력 형식을 확인해 주세요.");
        input.fieldNames().forEachRemaining(field -> { if (!FIELDS.contains(field)) throw invalid("지원하지 않는 면접 입력 항목이 포함됐습니다."); });
    }
    private static String title(JsonNode value) {
        if (value == null || !value.isTextual()) throw invalid("면접 제목을 입력해 주세요.");
        String title = value.textValue().strip();
        if (title.isEmpty() || title.length() > 200 || title.codePoints().anyMatch(c -> Character.isISOControl(c)))
            throw invalid("면접 제목은 공백을 제외해 1~200자로 입력해 주세요.");
        return title;
    }
    private static String choice(JsonNode value, Set<String> allowed, String error) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual() || !allowed.contains(value.textValue())) throw invalid(error);
        return value.textValue();
    }
    private static String memo(JsonNode value) {
        if (value == null || value.isNull()) return null;
        if (!value.isTextual()) throw invalid("메모를 다시 입력해 주세요.");
        String text = value.textValue().strip();
        if (text.length() > 500 || text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t'))
            throw invalid("메모는 500자 이내로 입력해 주세요.");
        return text.isEmpty() ? null : text;
    }
    private static Schedule schedule(JsonNode at, JsonNode zoneValue) {
        if (at == null || !at.isTextual() || zoneValue == null || !zoneValue.isTextual()) throw invalid("면접 날짜와 시간을 입력해 주세요.");
        String zoneName = zoneValue.textValue();
        if (zoneName.isBlank() || zoneName.length() > 100 || !ZoneId.getAvailableZoneIds().contains(zoneName)) throw invalid("면접 시간대를 확인해 주세요.");
        try {
            OffsetDateTime date = OffsetDateTime.parse(at.textValue());
            if (date.getYear() < 1 || date.getYear() > 9999) throw invalid("면접 날짜를 확인해 주세요.");
            Instant instant = date.toInstant();
            if (!ZoneId.of(zoneName).getRules().getOffset(instant).equals(date.getOffset())) throw invalid("면접 날짜·시간과 시간대가 일치하지 않습니다.");
            return new Schedule(instant.truncatedTo(ChronoUnit.MICROS), zoneName);
        } catch (DateTimeException exception) { throw invalid("면접 날짜와 시간을 확인해 주세요."); }
    }
    private record Schedule(Instant instant, String zone) { }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
    private static InterviewInputException invalid(String message) { return new InterviewInputException(message); }
}
