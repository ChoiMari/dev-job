package com.devjob.analysis.service;

import com.devjob.analysis.dto.MarketAnalyticsQuery;
import com.devjob.analysis.dto.MarketDistribution;
import com.devjob.analysis.dto.SkillTrend;
import com.devjob.analysis.dto.SkillTrendQuery;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class MarketAnalyticsService {
    private static final int MIN_SAMPLE = 10;
    private final EntityManager entities;

    public MarketAnalyticsService(EntityManager entities) { this.entities = entities; }

    public MarketDistribution careers(MarketAnalyticsQuery filter) {
        return distribution(filter, "j.careerRequirement", MarketAnalyticsService::career);
    }

    public MarketDistribution locations(MarketAnalyticsQuery filter) {
        return distribution(filter, "j.location", MarketAnalyticsService::location);
    }

    private MarketDistribution distribution(MarketAnalyticsQuery filter, String field, Function<String, String> classify) {
        filter.validate();
        var rows = bind(entities.createQuery("select " + field + ", count(j.id) from JobPosting j"
                + where(filter, false) + " group by " + field, Object[].class), filter).getResultList();
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Object[] row : rows) counts.merge(classify.apply((String) row[0]), ((Number) row[1]).longValue(), Long::sum);
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        var buckets = counts.entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(entry -> new MarketDistribution.Bucket(entry.getKey(), entry.getValue(), ratio(entry.getValue(), total)))
                .toList();
        return new MarketDistribution(total, total < MIN_SAMPLE, buckets);
    }

    public SkillTrend trends(SkillTrendQuery input) {
        MarketAnalyticsQuery filter = input.market();
        String from = " from AIAnalysis a join a.job j" + where(filter, true);
        var sampleRows = bind(entities.createQuery("select j.postedDate, count(a.id)" + from
                + " group by j.postedDate", Object[].class), filter).getResultList();
        var skillRows = bind(entities.createQuery("select j.postedDate, count(a.id)" + from
                + " and exists (select js.id from JobSkill js where js.job = j and js.skill.id = :skillId)"
                + " group by j.postedDate", Object[].class), filter)
                .setParameter("skillId", input.skillId()).getResultList();
        Map<LocalDate, Long> samples = periodCounts(sampleRows, input.interval());
        Map<LocalDate, Long> skills = periodCounts(skillRows, input.interval());
        List<SkillTrend.Period> periods = new ArrayList<>();
        for (LocalDate day = start(filter.from(), input.interval()); !day.isAfter(filter.to());
                day = input.interval() == SkillTrendQuery.Interval.WEEK ? day.plusWeeks(1) : day.plusMonths(1)) {
            long sample = samples.getOrDefault(day, 0L);
            long count = skills.getOrDefault(day, 0L);
            periods.add(new SkillTrend.Period(day, sample, count, sample == 0 ? null : ratio(count, sample), sample < MIN_SAMPLE));
        }
        return new SkillTrend(input.skillId(), input.interval().name(), periods);
    }

    private static Map<LocalDate, Long> periodCounts(List<Object[]> rows, SkillTrendQuery.Interval interval) {
        Map<LocalDate, Long> counts = new LinkedHashMap<>();
        for (Object[] row : rows) counts.merge(start((LocalDate) row[0], interval), ((Number) row[1]).longValue(), Long::sum);
        return counts;
    }

    private static LocalDate start(LocalDate date, SkillTrendQuery.Interval interval) {
        return interval == SkillTrendQuery.Interval.WEEK
                ? date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)) : date.withDayOfMonth(1);
    }

    private static String where(MarketAnalyticsQuery filter, boolean analyzed) {
        String result = analyzed ? " where a.status = com.devjob.analysis.entity.AIAnalysis.Status.COMPLETED"
                + " and j.postedDate is not null" : " where 1 = 1";
        if (filter.from() != null) result += " and j.postedDate >= :dateFrom";
        if (filter.to() != null) result += " and j.postedDate <= :dateTo";
        if (filter.source() != null) result += " and j.jobSource.code = :source";
        if (filter.desiredRole() != null) result += " and locate(:desiredRole, lower(j.title)) > 0";
        return result;
    }

    private static <T> TypedQuery<T> bind(TypedQuery<T> query, MarketAnalyticsQuery filter) {
        if (filter.from() != null) query.setParameter("dateFrom", filter.from());
        if (filter.to() != null) query.setParameter("dateTo", filter.to());
        if (filter.source() != null) query.setParameter("source", filter.source());
        if (filter.desiredRole() != null) query.setParameter("desiredRole", filter.desiredRole().toLowerCase(Locale.ROOT));
        return query;
    }

    private static double ratio(long part, long total) {
        return total == 0 ? 0 : Math.round((double) part / total * 10_000) / 10_000.0;
    }

    static String career(String raw) {
        if (raw == null || raw.isBlank()) return "UNKNOWN";
        String value = raw.toLowerCase(Locale.ROOT).replace(" ", "");
        if (value.contains("미상") || value.contains("미정") || value.contains("정보없음")) return "UNKNOWN";
        if (value.contains("무관") || value.contains("신입/경력") || value.contains("경력/신입")) return "ANY";
        if (value.contains("신입")) return "ENTRY";
        if (value.contains("경력") || value.matches(".*\\d+년.*")) return "EXPERIENCED";
        return "OTHER";
    }

    static String location(String raw) {
        if (raw == null || raw.isBlank()) return "UNKNOWN";
        String value = raw.strip();
        if (value.contains("미상") || value.contains("미정") || value.contains("정보없음")) return "UNKNOWN";
        if (value.contains("원격") || value.contains("재택") || value.contains("전국")) return "NATIONWIDE_REMOTE";
        String[][] regions = {{"서울", "SEOUL"}, {"부산", "BUSAN"}, {"대구", "DAEGU"},
                {"인천", "INCHEON"}, {"광주", "GWANGJU"}, {"대전", "DAEJEON"},
                {"울산", "ULSAN"}, {"세종", "SEJONG"}, {"경기", "GYEONGGI"},
                {"강원", "GANGWON"}, {"충북", "CHUNGBUK"}, {"충청북", "CHUNGBUK"},
                {"충남", "CHUNGNAM"}, {"충청남", "CHUNGNAM"}, {"전북", "JEONBUK"},
                {"전라북", "JEONBUK"}, {"전남", "JEONNAM"}, {"전라남", "JEONNAM"},
                {"경북", "GYEONGBUK"}, {"경상북", "GYEONGBUK"}, {"경남", "GYEONGNAM"},
                {"경상남", "GYEONGNAM"}, {"제주", "JEJU"}};
        String matched = null;
        for (String[] region : regions) {
            if (!value.contains(region[0])) continue;
            if (matched != null && !matched.equals(region[1])) return "OTHER";
            matched = region[1];
        }
        return matched == null ? "OTHER" : matched;
    }
}
