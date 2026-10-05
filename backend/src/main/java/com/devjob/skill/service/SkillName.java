package com.devjob.skill.service;

import java.text.Normalizer;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Shared validation for API, AI and external inputs. No fuzzy matching or punctuation removal. */
public record SkillName(String display, String key) {
    public static SkillName parse(String raw) {
        if (raw == null || raw.length() > 100 || raw.codePoints().anyMatch(cp ->
                Character.isISOControl(cp) || Character.getType(cp) == Character.FORMAT)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        String display = Normalizer.normalize(raw, Normalizer.Form.NFKC)
                .replaceAll("(?U)\\s+", " ").strip();
        String key = display.toLowerCase(Locale.ROOT);
        if (display.isBlank() || display.length() > 100 || key.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        return new SkillName(display, key);
    }
}
