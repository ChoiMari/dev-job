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

    /** Only an explicit user add may expand the catalog. Canonical names also reserve the alias namespace. */
    @Transactional
    public Skill resolveForUser(String input) {
        return resolveOrCreate(input);
    }

    /** S12: validated AI skill names use the same canonical namespace as explicit user additions. */
    @Transactional
    public Skill resolveForAnalysis(String input) {
        return resolveOrCreate(input);
    }

    private Skill resolveOrCreate(String input) {
        var name = SkillName.parse(input);
        var existing = find(name.key());
        if (existing.isPresent()) return existing.get();
        // ON CONFLICT waits for a concurrent creator without aborting this transaction.
        skills.insertIfAbsent(name.display(), name.key());
        var skill = skills.findByNormalizedName(name.key()).orElseThrow();
        aliases.insertIfAbsent(skill.getId(), skill.getName(), name.key());
        if (!aliases.resolve(name.key()).orElseThrow().getId().equals(skill.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
        return skill;
    }

    private Optional<Skill> find(String key) {
        return aliases.resolve(key).or(() -> skills.findByNormalizedName(key));
    }
}
