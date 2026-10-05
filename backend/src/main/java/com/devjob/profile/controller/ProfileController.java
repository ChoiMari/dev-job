package com.devjob.profile.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.profile.dto.*;
import com.devjob.profile.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/profile")
public class ProfileController {
    private final ProfileService profiles;
    public ProfileController(ProfileService profiles) { this.profiles = profiles; }
    @GetMapping
    public ProfileResponse get(@AuthenticationPrincipal CurrentUser user) { return profiles.get(user.id()); }
    @PutMapping
    public ResponseEntity<ProfileResponse> put(@AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody ProfileInput input) {
        var saved = profiles.put(user.id(), input);
        return ResponseEntity.status(saved.created() ? HttpStatus.CREATED : HttpStatus.OK).body(saved.profile());
    }
}
