package com.devjob.learninggoal.service;

import com.devjob.learninggoal.dto.LearningGoalInput;
import com.devjob.learninggoal.dto.LearningGoalResponse;
import com.devjob.learninggoal.dto.LearningGoalTaskInput;
import com.devjob.learninggoal.dto.LearningGoalTaskResponse;
import com.devjob.learninggoal.entity.LearningGoal;
import com.devjob.learninggoal.entity.LearningGoalTask;
import com.devjob.learninggoal.repository.LearningGoalRepository;
import com.devjob.learninggoal.repository.LearningGoalTaskRepository;
import com.devjob.skill.entity.Skill;
import com.devjob.skill.repository.SkillRepository;
import com.devjob.user.repository.UserRepository;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
public class LearningGoalService {
    private final LearningGoalRepository goals;
    private final SkillRepository skills;
    private final UserRepository users;
    private final LearningGoalTaskRepository tasks;

    public LearningGoalService(LearningGoalRepository goals, SkillRepository skills, UserRepository users,
            LearningGoalTaskRepository tasks) {
        this.goals = goals;
        this.skills = skills;
        this.users = users;
        this.tasks = tasks;
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
        if (input.progressPresent() && tasks.countByGoalId(id) > 0 && progress != goal.getProgressPercent())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "체크목록이 있는 목표의 진행률은 자동 계산됩니다.");
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

    @Transactional(readOnly = true)
    public List<LearningGoalTaskResponse> listTasks(Long userId, Long goalId) {
        owned(userId, goalId, false);
        return tasks.findByGoalIdOrderByIdAsc(goalId).stream().map(LearningGoalTaskResponse::from).toList();
    }

    @Transactional
    public LearningGoalTaskResponse addTask(Long userId, Long goalId, LearningGoalTaskInput input) {
        var goal = owned(userId, goalId, true);
        ensureEditable(goal);
        var task = tasks.saveAndFlush(new LearningGoalTask(goal, input.title()));
        updateTaskProgress(goal);
        return LearningGoalTaskResponse.from(task);
    }

    @Transactional
    public LearningGoalTaskResponse updateTask(Long userId, Long goalId, Long taskId, LearningGoalTaskInput input) {
        var goal = owned(userId, goalId, true);
        ensureEditable(goal);
        var task = task(goalId, taskId);
        task.update(input.title() == null ? task.getTitle() : input.title(),
                input.completed() == null ? task.isCompleted() : input.completed());
        tasks.flush();
        updateTaskProgress(goal);
        return LearningGoalTaskResponse.from(task);
    }

    @Transactional
    public void deleteTask(Long userId, Long goalId, Long taskId) {
        var goal = owned(userId, goalId, true);
        ensureEditable(goal);
        tasks.delete(task(goalId, taskId));
        tasks.flush();
        updateTaskProgress(goal);
    }

    private LearningGoalTask task(Long goalId, Long taskId) {
        if (taskId == null || taskId < 1) throw badInput();
        var task = tasks.findById(taskId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!task.getGoalId().equals(goalId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return task;
    }

    private static void ensureEditable(LearningGoal goal) {
        if (goal.getCompletedAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "완료한 목표의 체크목록을 바꾸려면 먼저 완료를 취소해 주세요.");
    }

    private void updateTaskProgress(LearningGoal goal) {
        long total = tasks.countByGoalId(goal.getId());
        long done = tasks.countByGoalIdAndCompletedTrue(goal.getId());
        goal.setTaskProgress(total == 0 ? 0 : (int) (100 * done / total));
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
