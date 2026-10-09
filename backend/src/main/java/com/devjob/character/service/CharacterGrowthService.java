package com.devjob.character.service;

import com.devjob.character.dto.*;
import com.devjob.character.entity.*;
import com.devjob.character.repository.*;
import com.devjob.todo.entity.PersonalTodo;
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
            new Quest("TODO_1", 1, "PEACH"), new Quest("TODO_3", 3, "BEAR"),
            new Quest("TODO_5", 5, "HOMEBODY"), new Quest("TODO_10", 10, "INTERVIEW"),
            new Quest("TODO_20", 20, "RAINCOAT"), new Quest("TODO_30", 30, "ASTRONAUT"));
    private final CharacterActivityRepository activities;
    private final CharacterRewardRepository rewards;
    private final UserRepository users;
    public CharacterGrowthService(CharacterActivityRepository activities, CharacterRewardRepository rewards,
            UserRepository users) {
        this.activities = activities; this.rewards = rewards; this.users = users;
    }

    // Called only after TodoService has locked and verified the owner's completion transition.
    @Transactional
    public void awardTodoCompletion(PersonalTodo todo) {
        if (!todo.isRewardEligible() || todo.getCompletedAt() == null) return;
        if (activities.existsByUserIdAndActivityTypeAndActivityId(todo.getUserId(), TODO_COMPLETED, todo.getId())) return;
        var user = users.findById(todo.getUserId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        activities.saveAndFlush(new CharacterActivity(user, TODO_COMPLETED, todo.getId(), TODO_EXP,
                Instant.now().truncatedTo(ChronoUnit.MICROS)));
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
        long count = activities.countByUserIdAndActivityType(userId, TODO_COMPLETED);
        var claimed = rewards.findByUserId(userId).stream().collect(java.util.stream.Collectors.toMap(
                CharacterReward::getQuestId, reward -> reward));
        return QUESTS.stream().map(quest -> {
            var reward = claimed.get(quest.id());
            return new CharacterQuestResponse(quest.id(), TODO_COMPLETED, quest.count(),
                    Math.min(count, quest.count()), quest.itemId(), count >= quest.count(), reward != null,
                    reward == null ? null : reward.getClaimedAt());
        }).toList();
    }

    @Transactional
    public CharacterClaimResponse claim(Long userId, String questId) {
        Quest quest = QUESTS.stream().filter(candidate -> candidate.id().equals(questId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        // The same owner lock is used by equipment changes, so claim and equip cannot pass each other.
        var user = users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var existing = rewards.findByUserIdAndQuestId(userId, questId);
        if (existing.isPresent()) {
            var reward = existing.get();
            return new CharacterClaimResponse(questId, reward.getItemId(), reward.getClaimedAt(), progress(userId));
        }
        if (activities.countByUserIdAndActivityType(userId, TODO_COMPLETED) < quest.count())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "퀘스트 달성 조건을 충족하지 않았습니다.");
        var reward = rewards.saveAndFlush(new CharacterReward(user, questId, quest.itemId(),
                Instant.now().truncatedTo(ChronoUnit.MICROS)));
        return new CharacterClaimResponse(questId, reward.getItemId(), reward.getClaimedAt(), progress(userId));
    }
    private record Quest(String id, long count, String itemId) { }
}
