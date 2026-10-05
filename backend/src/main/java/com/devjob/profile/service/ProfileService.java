package com.devjob.profile.service;

import com.devjob.profile.dto.*;
import com.devjob.profile.entity.Profile;
import com.devjob.profile.repository.ProfileRepository;
import com.devjob.user.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProfileService {
    private final ProfileRepository profiles;
    private final UserRepository users;
    public ProfileService(ProfileRepository profiles, UserRepository users) {
        this.profiles = profiles;
        this.users = users;
    }
    @Transactional(readOnly = true)
    public ProfileResponse get(Long userId) {
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var profile = profiles.findByUserId(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ProfileResponse.from(profile, user);
    }
    @Transactional
    public SavedProfile put(Long userId, ProfileInput input) {
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!user.getEmail().equals(input.email()) && users.existsByEmail(input.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
        var existing = profiles.findByUserId(userId);
        var profile = existing.orElseGet(() -> new Profile(user));
        profile.update(input.name(), input.desiredRole(), input.careerLevel(), input.desiredLocation(),
                input.introduction(), input.education(), input.certifications());
        user.changeEmail(input.email());
        try {
            users.saveAndFlush(user);
            profile = profiles.saveAndFlush(profile);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
        return new SavedProfile(ProfileResponse.from(profile, user), existing.isEmpty());
    }
    public record SavedProfile(ProfileResponse profile, boolean created) { }
}
