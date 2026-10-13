package com.devjob.skill.service;

import com.devjob.skill.entity.Skill;
import com.devjob.skill.repository.*;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SkillNormalizer {
    private final SkillRepository skills;
    private final SkillAliasRepository aliases;
    public SkillNormalizer(SkillRepository skills, SkillAliasRepository aliases) {
        this.skills = skills; this.aliases = aliases;
    }

    /** AI/external boundary: validate first, resolve existing catalog only. Unknown is explicit and never persisted. */
    @Transactional(readOnly = true)
    public Optional<Skill> resolveExisting(String input) {
        return find(SkillName.parse(input).key());
    }

    /** User selection can resolve only curated system skills. */
    @Transactional(readOnly = true)
    public Skill resolveForUser(String input) {
        return find(SkillName.parse(input).key()).filter(Skill::isSystem)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    /** AI names outside the fixed catalog remain in analysis JSON and user candidates. */
    @Transactional(readOnly = true)
    public Optional<Skill> resolveForAnalysis(String input) {
        return find(SkillName.parse(input).key()).filter(Skill::isSystem);
    }

    private Optional<Skill> find(String key) {
        return skills.findByNormalizedName(key).or(() -> aliases.resolve(key));
    }
}
