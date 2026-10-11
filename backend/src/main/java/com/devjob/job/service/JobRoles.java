package com.devjob.job.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Title-based role labels; ambiguous public-sector titles remain unclassified. */
public final class JobRoles {
    private JobRoles() { }
    public static final String OTHER = "OTHER";
    public static final Map<String, List<String>> TERMS = Map.of(
            "DEVELOPMENT", List.of("개발자", "개발", "소프트웨어", "백엔드", "프론트엔드", "웹", "앱", "java", "spring", "backend", "frontend", "developer", "software"),
            "DATA_AI", List.of("데이터", "인공지능", "머신러닝", "ai", "ml", "data"),
            "SECURITY", List.of("정보보안", "보안관제", "사이버", "security"),
            "INFRA", List.of("클라우드", "인프라", "데브옵스", "devops", "cloud", "서버", "정보시스템"),
            "IT_OPERATIONS", List.of("전산", "정보화", "정보운영", "it 운영"));
    public static final List<String> ALL_TERMS = TERMS.values().stream().flatMap(List::stream).distinct().toList();
    public static boolean supports(String role) { return OTHER.equals(role) || TERMS.containsKey(role); }
    public static boolean matches(String title, String role) {
        if (title == null || !TERMS.containsKey(role)) return false;
        String lower = title.toLowerCase(Locale.ROOT);
        return TERMS.get(role).stream().anyMatch(lower::contains);
    }
    public static String classify(String title) {
        for (String role : List.of("DEVELOPMENT", "DATA_AI", "SECURITY", "INFRA", "IT_OPERATIONS"))
            if (matches(title, role)) return role;
        return null;
    }
}
