package com.devjob.job.service;

import java.util.List;
import java.util.Locale;

/** Conservative title signals for software, data and cyber security roles. */
public final class ItJobTitles {
    private ItJobTitles() { }

    public static final List<String> TERMS = List.of(
            "소프트웨어", "개발자", "웹개발", "웹 개발", "앱개발", "앱 개발", "프로그램 개발", "시스템 개발",
            "정보개발", "정보 개발", "백엔드", "프론트엔드", "서버 개발", "java", "spring", "devops", "데브옵스",
            "sw 개발", "sw개발", "it 개발", "it개발", "ai 개발", "ai개발", "ml", "인프라",
            "전산", "정보시스템", "정보화", "데이터", "인공지능", "머신러닝",
            "정보보안", "보안관제", "사이버", "클라우드", "서버", "데이터베이스",
            "software", "developer", "backend", "frontend", "cloud", "security",
            "sw개발", "it개발", "ai개발");

    public static boolean matches(String title) {
        if (title == null) return false;
        String value = title.toLowerCase(Locale.ROOT);
        return TERMS.stream().anyMatch(value::contains);
    }
}
