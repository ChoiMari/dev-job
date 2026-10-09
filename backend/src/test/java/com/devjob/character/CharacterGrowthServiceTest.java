package com.devjob.character;

import com.devjob.character.dto.CharacterProgress;
import com.devjob.character.entity.CharacterActivity;
import com.devjob.character.entity.CharacterReward;
import com.devjob.character.repository.CharacterActivityRepository;
import com.devjob.character.repository.CharacterRewardRepository;
import com.devjob.character.service.CharacterGrowthService;
import com.devjob.todo.entity.PersonalTodo;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
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
    private final UserRepository users = mock(UserRepository.class);
    private final CharacterGrowthService growth = new CharacterGrowthService(activities, rewards, users);

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
        when(rewards.saveAndFlush(any())).thenReturn(reward);
        var first = growth.claim(1L, "TODO_1");
        when(rewards.findByUserIdAndQuestId(1L, "TODO_1")).thenReturn(Optional.of(reward));
        var retry = growth.claim(1L, "TODO_1");
        assertThat(first).isEqualTo(retry);
        verify(rewards, times(1)).saveAndFlush(any());
        assertThatThrownBy(() -> growth.claim(1L, "UNKNOWN"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }
}
