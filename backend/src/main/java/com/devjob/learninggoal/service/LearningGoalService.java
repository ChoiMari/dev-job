package com.devjob.learninggoal.service;

import com.devjob.learninggoal.dto.LearningGoalInput;
import com.devjob.learninggoal.dto.LearningGoalResponse;
import com.devjob.learninggoal.entity.LearningGoal;
import com.devjob.learninggoal.repository.LearningGoalRepository;
import com.devjob.skill.entity.Skill;
import com.devjob.skill.repository.SkillRepository;
import com.devjob.user.repository.UserRepository;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LearningGoalService {
    private final LearningGoalRepository goals;
    private final SkillRepository skills;
    private final UserRepository users;

    public LearningGoalService(LearningGoalRepository goals, SkillRepository skills, UserRepository users) {
        this.goals = goals;
        this.skills = skills;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Page<LearningGoalResponse> list(Long userId, Boolean completed, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        return goals.list(userId, completed, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id")))).map(LearningGoalResponse::from);
    }

    @Transactional(readOnly = true)
    public LearningGoalResponse get(Long userId, Long id) { return LearningGoalResponse.from(owned(userId, id, false)); }

    @Transactional
    public LearningGoalResponse create(Long userId, LearningGoalInput input) {
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var skill = skill(input.skillId());
        return LearningGoalResponse.from(goals.saveAndFlush(new LearningGoal(user, skill, input.title(),
                input.description(), input.progressPresent() ? input.progressPercent() : 0)));
    }

    @Transactional
    public LearningGoalResponse update(Long userId, Long id, LearningGoalInput input) {
        var goal = owned(userId, id, true);
        Skill skill = input.skillPresent() ? skill(input.skillId()) : goal.getSkill();
        String title = input.titlePresent() ? input.title() : goal.getTitle();
        String description = input.descriptionPresent() ? input.description() : goal.getDescription();
        int progress = input.progressPresent() ? input.progressPercent() : goal.getProgressPercent();
        try { goal.update(skill, title, description, progress); }
        catch (IllegalStateException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT); }
        goals.flush();
        return LearningGoalResponse.from(goal);
    }

    @Transactional
    public LearningGoalResponse complete(Long userId, Long id, boolean completed) {
        var goal = owned(userId, id, true);
        try { goal.setCompleted(completed); }
        catch (IllegalStateException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT); }
        goals.flush();
        return LearningGoalResponse.from(goal);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        owned(userId, id, true).delete();
        goals.flush();
    }

    private LearningGoal owned(Long userId, Long id, boolean lock) {
        if (id == null || id < 1) throw badInput();
        var goal = (lock ? goals.findForUpdate(id) : goals.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (goal.getDeletedAt() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!goal.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return goal;
    }
    private Skill skill(Long skillId) {
        return skillId == null ? null : skills.findById(skillId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
