package com.devjob.character.service;

import com.devjob.character.dto.*;
import com.devjob.character.entity.*;
import com.devjob.character.repository.*;
import com.devjob.todo.entity.PersonalTodo;
import com.devjob.notification.NotificationEventRecorder;
import com.devjob.notification.NotificationType;
import com.devjob.user.repository.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CharacterGrowthService {
    public static final String TODO_COMPLETED = "TODO_COMPLETED";
    private static final int TODO_EXP = 10;
    private static final List<Quest> QUESTS = List.of(
            new Quest("TODO_1", TODO_COMPLETED, 1, "PEACH"),
            new Quest("BOOKMARK_3", "BOOKMARK_SAVED", 3, "BEAR"),
            new Quest("RESUME_1", "RESUME_CREATED", 1, "HOMEBODY"),
            new Quest("APPLICATION_1", "APPLICATION_CREATED", 1, "INTERVIEW"),
            new Quest("LEARNING_1", "LEARNING_GOAL_COMPLETED", 1, "RAINCOAT"),
            new Quest("ANALYSIS_1", "DOCUMENT_ANALYSIS_REQUESTED", 1, "ASTRONAUT"));
    private final CharacterActivityRepository activities;
    private final CharacterRewardRepository rewards;
    private final CharacterQuestProgressRepository questProgress;
    private final UserRepository users;
    private final NotificationEventRecorder notifications;
    public CharacterGrowthService(CharacterActivityRepository activities, CharacterRewardRepository rewards,
            CharacterQuestProgressRepository questProgress, UserRepository users,
            NotificationEventRecorder notifications) {
        this.activities = activities; this.rewards = rewards; this.questProgress = questProgress; this.users = users;
        this.notifications = notifications;
    }

    // Called only after TodoService has locked and verified the owner's completion transition.
    @Transactional
    public void awardTodoCompletion(PersonalTodo todo) {
        if (!todo.isRewardEligible() || todo.getCompletedAt() == null) return;
        if (activities.existsByUserIdAndActivityTypeAndActivityId(todo.getUserId(), TODO_COMPLETED, todo.getId())) return;
        var user = users.findById(todo.getUserId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var activity = activities.saveAndFlush(new CharacterActivity(user, TODO_COMPLETED, todo.getId(), TODO_EXP,
                Instant.now().truncatedTo(ChronoUnit.MICROS)));
        notifications.record(NotificationType.CHARACTER_ACTIVITY, activity.getId() * 2, activity.getEarnedAt());
    }

    @Transactional(readOnly = true)
    public CharacterProgress progress(Long userId) { return CharacterProgress.from(activities.totalExp(userId)); }

    @Transactional(readOnly = true)
    public CharacterActivityResponse.Page activity(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var result = activities.findByUserIdOrderByEarnedAtDescIdDesc(userId, PageRequest.of(page, size));
        return new CharacterActivityResponse.Page(result.map(CharacterActivityResponse::from).getContent(),
                page, size, result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public List<CharacterQuestResponse> quests(Long userId) {
        var claimed = rewards.findByUserId(userId).stream().collect(java.util.stream.Collectors.toMap(
                CharacterReward::getItemId, reward -> reward));
        return QUESTS.stream().map(quest -> {
            long count = progressFor(userId, quest);
            var reward = claimed.get(quest.itemId());
            return new CharacterQuestResponse(quest.id(), quest.activityType(), quest.count(),
                    reward == null ? Math.min(count, quest.count()) : quest.count(),
                    quest.itemId(), count >= quest.count() || reward != null, reward != null,
                    reward == null ? null : reward.getClaimedAt());
        }).toList();
    }

    @Transactional
    public CharacterClaimResponse claim(Long userId, String questId) {
        // The same owner lock is used by equipment changes, so claim and equip cannot pass each other.
        var user = users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var existing = rewards.findByUserIdAndQuestId(userId, questId);
        if (existing.isPresent()) {
            var reward = existing.get();
            return new CharacterClaimResponse(questId, reward.getItemId(), reward.getClaimedAt(), progress(userId));
        }
        Quest quest = QUESTS.stream().filter(candidate -> candidate.id().equals(questId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // Old TODO quests may already have awarded this same item. Keep that entitlement and timestamp.
        var itemReward = rewards.findByUserIdAndItemId(userId, quest.itemId());
        if (itemReward.isPresent()) {
            var reward = itemReward.get();
            return new CharacterClaimResponse(questId, reward.getItemId(), reward.getClaimedAt(), progress(userId));
        }
        if (progressFor(userId, quest) < quest.count())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "퀘스트 달성 조건을 충족하지 않았습니다.");
        var reward = rewards.saveAndFlush(new CharacterReward(user, questId, quest.itemId(),
                Instant.now().truncatedTo(ChronoUnit.MICROS)));
        notifications.record(NotificationType.CHARACTER_ACTIVITY, reward.getId() * 2 + 1, reward.getClaimedAt());
        return new CharacterClaimResponse(questId, reward.getItemId(), reward.getClaimedAt(), progress(userId));
    }
    private long progressFor(Long userId, Quest quest) {
        return switch (quest.activityType()) {
            case TODO_COMPLETED -> activities.countByUserIdAndActivityType(userId, TODO_COMPLETED);
            case "BOOKMARK_SAVED" -> questProgress.bookmarkCount(userId);
            case "RESUME_CREATED" -> questProgress.resumeCount(userId);
            case "APPLICATION_CREATED" -> questProgress.applicationCount(userId);
            case "LEARNING_GOAL_COMPLETED" -> questProgress.completedLearningGoalCount(userId);
            case "DOCUMENT_ANALYSIS_REQUESTED" -> questProgress.documentAnalysisCount(userId);
            default -> throw new IllegalStateException("Unknown quest activity type");
        };
    }
    private record Quest(String id, String activityType, long count, String itemId) { }
}
