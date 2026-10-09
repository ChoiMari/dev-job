package com.devjob.auth.service;

import com.devjob.auth.dto.Credentials;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder passwords) {
        this.users = users;
        this.passwords = passwords;
        this.dummyHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    @Transactional
    public CurrentUser register(Credentials credentials) {
        if (users.existsByEmail(credentials.email())) throw new ResponseStatusException(HttpStatus.CONFLICT);
        try {
            var user = users.saveAndFlush(new User(credentials.email(), passwords.encode(credentials.password())));
            return new CurrentUser(user.getId(), user.getEmail());
        } catch (DataIntegrityViolationException exception) {
            // The DB constraint also protects concurrent registrations that pass the precheck.
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
    }

    @Transactional
    public CurrentUser authenticate(Credentials credentials) {
        return authenticateSession(credentials).user();
    }

    @Transactional
    public SessionLogin authenticateSession(Credentials credentials) {
        var user = users.findByEmailForUpdate(credentials.email());
        boolean matches = passwords.matches(credentials.password(), user.map(User::getPasswordHash).orElse(dummyHash));
        if (user.isEmpty() || !matches) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return new SessionLogin(new CurrentUser(user.get().getId(), user.get().getEmail()),
                user.get().getCredentialVersion());
    }

    @Transactional
    public void changePassword(Long userId, com.devjob.auth.dto.PasswordChangeRequest request) {
        var user = users.findByIdForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!passwords.matches(request.currentPassword(), user.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (passwords.matches(request.newPassword(), user.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        user.changePassword(passwords.encode(request.newPassword()));
    }

    public record SessionLogin(CurrentUser user, long credentialVersion) { }

    @Transactional(readOnly = true)
    public CurrentUser current(Long id) {
        var user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return new CurrentUser(user.getId(), user.getEmail());
    }
}
