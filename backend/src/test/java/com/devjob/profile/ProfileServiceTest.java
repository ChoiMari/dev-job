package com.devjob.profile;

import com.devjob.profile.dto.ProfileInput;
import com.devjob.profile.entity.Profile;
import com.devjob.profile.repository.ProfileRepository;
import com.devjob.profile.service.ProfileService;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProfileServiceTest {
    private final ProfileRepository profiles = mock(ProfileRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ProfileService service = new ProfileService(profiles, users);
    private final User owner = new User("owner@example.com", "hash");
    private final ProfileInput input = new ProfileInput(" Owner@Example.com ", "홍길동", "백엔드", null, null, null, null, null);

    @Test void missingProfileIs404AndDoesNotInspectOtherUsers() {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        assertThatThrownBy(() -> service.get(1L)).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
        verify(profiles).findByUserId(1L);
        verifyNoMoreInteractions(profiles);
    }

    @Test void firstSaveAndUpdateUseAuthenticatedOwnerAndKeepEmailOnUser() {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(profiles.findByUserId(1L)).thenReturn(Optional.empty());
        when(profiles.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var created = service.put(1L, input);
        assertThat(created.created()).isTrue();
        assertThat(owner.getEmail()).isEqualTo("owner@example.com");
        assertThat(created.profile().nickname()).isEqualTo("홍길동");
        var saved = org.mockito.ArgumentCaptor.forClass(Profile.class);
        verify(profiles).saveAndFlush(saved.capture());
        when(profiles.findByUserId(1L)).thenReturn(Optional.of(saved.getValue()));
        var updated = service.put(1L, new ProfileInput("owner@example.com", "수정", null, null, null, null, null, null));
        assertThat(updated.created()).isFalse();
        assertThat(updated.profile().nickname()).isEqualTo("수정");
        assertThat(updated.profile().desiredRole()).isNull();
        verify(profiles, times(2)).findByUserId(1L);
    }

    @Test void changedLoginEmailDoesNotSaveProfile() {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        assertThatThrownBy(() -> service.put(1L, new ProfileInput("new@example.com", "홍길동", null, null, null, null, null, null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        verifyNoInteractions(profiles);
    }

    @Test void missingAuthenticatedUserCannotSelectAnotherProfile() {
        assertThatThrownBy(() -> service.get(2L)).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("401");
        verifyNoInteractions(profiles);
    }
}
