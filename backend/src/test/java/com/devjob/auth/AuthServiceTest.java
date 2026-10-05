package com.devjob.auth;

import com.devjob.auth.dto.Credentials;
import com.devjob.auth.service.AuthService;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final AuthService auth = new AuthService(users, passwords);

    @Test
    void storesSaltedHashRatherThanPlaintext() {
        when(users.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        auth.register(new Credentials(" User@Example.com ", "password123"));
        var captor = ArgumentCaptor.forClass(User.class);
        verify(users).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getEmail()).isEqualTo("user@example.com");
        String hash = captor.getValue().getPasswordHash();
        assertThat(hash).isNotEqualTo("password123");
        assertThat(passwords.matches("password123", hash)).isTrue();
        assertThat(passwords.matches("different123", hash)).isFalse();
        assertThat(passwords.encode("password123")).isNotEqualTo(hash);
    }

    @Test
    void concurrentUniqueConstraintViolationBecomes409() {
        when(users.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("private SQL"));
        assertThatThrownBy(() -> auth.register(new Credentials("user@example.com", "password123")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(409));
    }

    @Test
    void exactUtf8ByteBoundaryCanBeHashedAndLongerInputIsRejected() {
        String boundary = "가".repeat(24);
        var valid = new Credentials("user@example.com", boundary);
        assertThat(valid.isPasswordWithinByteLimit()).isTrue();
        assertThat(passwords.matches(boundary, passwords.encode(boundary))).isTrue();
        assertThat(new Credentials("user@example.com", boundary + "a").isPasswordWithinByteLimit()).isFalse();
    }

    @Test
    void unknownEmailAndWrongPasswordHaveSame401() {
        when(users.findByEmail("known@example.com"))
                .thenReturn(Optional.of(new User("known@example.com", passwords.encode("password123"))));
        when(users.findByEmail("unknown@example.com")).thenReturn(Optional.empty());
        for (String email : new String[]{"known@example.com", "unknown@example.com"}) {
            assertThatThrownBy(() -> auth.authenticate(new Credentials(email, "incorrect123")))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            error -> assertThat(error.getStatusCode().value()).isEqualTo(401));
        }
        assertThat(new Credentials("user@example.com", "secret123").toString()).doesNotContain("secret123");
    }
}
