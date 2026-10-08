package com.devjob.skill.service;

import com.devjob.skill.dto.*;
import com.devjob.skill.repository.*;
import java.util.List;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SkillService {
    private final SkillRepository skills;
    private final UserSkillRepository owned;
    private final SkillNormalizer normalizer;
    public SkillService(SkillRepository skills, UserSkillRepository owned, SkillNormalizer normalizer) {
        this.skills = skills; this.owned = owned; this.normalizer = normalizer;
    }
    @Transactional(readOnly = true)
    public Page<SkillResponse> search(String query, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        String key = query == null || query.isEmpty() ? "" : SkillName.parse(query).key();
        return skills.search(key, PageRequest.of(page, size, Sort.by("normalizedName", "id"))).map(SkillResponse::from);
    }
    @Transactional(readOnly = true)
    public List<OwnedSkillResponse> list(Long userId) { return owned.findOwned(userId).stream().map(OwnedSkillResponse::from).toList(); }

    @Transactional
    public OwnedSkillResponse updateExperience(Long userId, Long skillId, SkillExperiencePatch input) {
        if (skillId == null || skillId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (owned.updateExperience(userId, skillId, input.levelPresent(), input.level(),
                input.monthsPresent(), input.months()) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return owned.findOwned(userId, skillId).map(OwnedSkillResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    @Transactional
    public SkillResponse add(Long userId, AddSkillRequest input) {
        if (!input.isSingleSelection() || input.skillId() != null && input.skillId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        var skill = input.skillId() == null ? normalizer.resolveForUser(input.name())
                : skills.findById(input.skillId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (owned.add(userId, skill.getId()) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT);
        return SkillResponse.from(skill);
    }
    @Transactional
    public void delete(Long userId, Long skillId) {
        if (skillId <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (owned.remove(userId, skillId) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
}
