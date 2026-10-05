package com.devjob.profile.dto;

import com.devjob.profile.entity.Profile;
import com.devjob.user.entity.User;

public record ProfileResponse(Long id, String email, String name, String desiredRole, String careerLevel,
        String desiredLocation, String introduction, String education, String certifications) {
    public static ProfileResponse from(Profile profile, User user) {
        return new ProfileResponse(profile.getId(), user.getEmail(), profile.getName(), profile.getDesiredRole(),
                profile.getCareerLevel(), profile.getDesiredLocation(), profile.getIntroduction(),
                profile.getEducation(), profile.getCertifications());
    }
}
