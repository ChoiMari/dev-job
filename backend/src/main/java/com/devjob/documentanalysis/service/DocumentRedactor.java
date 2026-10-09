package com.devjob.documentanalysis.service;

import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class DocumentRedactor {
    private static final Pattern EMAIL = Pattern.compile("(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}");
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(?:\\+82[- .]?)?0?1[016789][- .]?\\d{3,4}[- .]?\\d{4}(?!\\d)");
    private static final Pattern NATIONAL_ID = Pattern.compile("(?<!\\d)\\d{6}[- ]?[1-8]\\d{6}(?!\\d)");
    private static final Pattern LABELED = Pattern.compile("(?im)^\\s*(?:이름|성명|주소|생년월일|주민등록번호|연락처|전화번호|이메일)\\s*[:：]\\s*[^\\r\\n]+");
    private static final Pattern URL = Pattern.compile("(?i)https?://\\S+");

    public String redact(String raw) {
        String result = LABELED.matcher(raw).replaceAll("[개인정보 삭제]");
        result = NATIONAL_ID.matcher(result).replaceAll("[주민등록번호 삭제]");
        result = EMAIL.matcher(result).replaceAll("[이메일 삭제]");
        result = PHONE.matcher(result).replaceAll("[전화번호 삭제]");
        return URL.matcher(result).replaceAll("[URL 삭제]");
    }
    public boolean containsStructuredPersonalData(String value) {
        return EMAIL.matcher(value).find() || PHONE.matcher(value).find() || NATIONAL_ID.matcher(value).find();
    }
}
