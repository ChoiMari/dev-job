package com.devjob.character;

import com.devjob.character.dto.CharacterProgress;
import com.devjob.character.entity.CharacterActivity;
import com.devjob.character.entity.CharacterReward;
import com.devjob.character.repository.CharacterActivityRepository;
import com.devjob.character.repository.CharacterRewardRepository;
import com.devjob.character.repository.CharacterQuestProgressRepository;
import com.devjob.character.service.CharacterGrowthService;
import com.devjob.todo.entity.PersonalTodo;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.devjob.notification.NotificationEventRecorder;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CharacterGrowthServiceTest {
    private final CharacterActivityRepository activities = mock(CharacterActivityRepository.class);
    private final CharacterRewardRepository rewards = mock(CharacterRewardRepository.class);
    private final CharacterQuestProgressRepository questProgress = mock(CharacterQuestProgressRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CharacterGrowthService growth = new CharacterGrowthService(activities, rewards, questProgress, users,
            mock(NotificationEventRecorder.class));

    @Test void levelBoundariesUseAccumulatedVerifiedExp() {
        assertThat(CharacterProgress.from(0)).isEqualTo(new CharacterProgress(1, 0, 0, 100));
        assertThat(CharacterProgress.from(99)).isEqualTo(new CharacterProgress(1, 99, 99, 100));
        assertThat(CharacterProgress.from(100)).isEqualTo(new CharacterProgress(2, 100, 0, 150));
        assertThat(CharacterProgress.from(250)).isEqualTo(new CharacterProgress(3, 250, 0, 200));
        assertThat(CharacterProgress.from(450)).isEqualTo(new CharacterProgress(4, 450, 0, 250));
    }

    @Test void awardRequiresEligibleCompletedTodoAndSkipsExistingActivity() {
        User user = mock(User.class);
        when(user.getId()).thenReturn(1L);
        PersonalTodo todo = new PersonalTodo(user, "Finish", null, null, null);
        todo.setCompleted(true);
        when(users.findById(1L)).thenReturn(Optional.of(user));
        CharacterActivity saved = mock(CharacterActivity.class);
        when(saved.getId()).thenReturn(2L);
        when(saved.getEarnedAt()).thenReturn(Instant.now());
        when(activities.saveAndFlush(any())).thenReturn(saved);
        growth.awardTodoCompletion(todo);
        verify(activities).saveAndFlush(any(CharacterActivity.class));
        reset(activities);
        when(activities.existsByUserIdAndActivityTypeAndActivityId(1L, "TODO_COMPLETED", null))
                .thenReturn(true);
        growth.awardTodoCompletion(todo);
        verify(activities, never()).saveAndFlush(any());
    }

    @Test void claimRequiresThresholdAndRetryReturnsOriginalClaim() {
        User user = mock(User.class);
        when(users.findByIdForUpdate(1L)).thenReturn(Optional.of(user));
        assertThatThrownBy(() -> growth.claim(1L, "TODO_1"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        verify(rewards, never()).saveAndFlush(any());
        when(activities.countByUserIdAndActivityType(1L, "TODO_COMPLETED")).thenReturn(1L);
        CharacterReward reward = new CharacterReward(user, "TODO_1", "PEACH", Instant.parse("2026-10-09T00:00:00Z"));
        org.springframework.test.util.ReflectionTestUtils.setField(reward, "id", 3L);
        when(rewards.saveAndFlush(any())).thenReturn(reward);
        var first = growth.claim(1L, "TODO_1");
        when(rewards.findByUserIdAndQuestId(1L, "TODO_1")).thenReturn(Optional.of(reward));
        var retry = growth.claim(1L, "TODO_1");
        assertThat(first).isEqualTo(retry);
        verify(rewards, times(1)).saveAndFlush(any());
        assertThatThrownBy(() -> growth.claim(1L, "UNKNOWN"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }

    @Test void questsUseDistinctVerifiedActivitiesAndPreserveLegacyRewards() {
        User user = mock(User.class);
        when(activities.countByUserIdAndActivityType(1L, "TODO_COMPLETED")).thenReturn(1L);
        when(questProgress.bookmarkCount(1L)).thenReturn(2L);
        when(questProgress.resumeCount(1L)).thenReturn(1L);
        when(questProgress.applicationCount(1L)).thenReturn(0L);
        when(questProgress.completedLearningGoalCount(1L)).thenReturn(1L);
        when(questProgress.documentAnalysisCount(1L)).thenReturn(0L);
        CharacterReward legacy = new CharacterReward(user, "TODO_5", "HOMEBODY", Instant.parse("2026-10-09T00:00:00Z"));
        when(rewards.findByUserId(1L)).thenReturn(java.util.List.of(legacy));
        var quests = growth.quests(1L);
        assertThat(quests).extracting(q -> q.id()).containsExactly(
                "TODO_1", "BOOKMARK_3", "RESUME_1", "APPLICATION_1", "LEARNING_1", "ANALYSIS_1");
        assertThat(quests.get(1).progressCount()).isEqualTo(2);
        assertThat(quests.get(1).completed()).isFalse();
        assertThat(quests.get(2).claimed()).isTrue();
        assertThat(quests.get(2).completed()).isTrue();
        assertThat(quests.get(2).progressCount()).isEqualTo(1);
    }
}
