package com.devjob.skill.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.skill.service.AccountSkillService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
public class AccountSkillController {
    public record NameInput(@NotBlank @Size(max = 100) String name) { }
    public record CustomInput(@NotBlank @Size(max = 100) String name, Integer proficiencyLevel) { }
    public record CustomList(List<AccountSkillService.CustomSkill> items) { }
    public record CandidateList(List<AccountSkillService.AiCandidate> items) { }
    private final AccountSkillService skills;

    public AccountSkillController(AccountSkillService skills) { this.skills = skills; }

    @GetMapping("/custom-skills")
    public CustomList custom(@AuthenticationPrincipal CurrentUser user) {
        return new CustomList(skills.customSkills(user.id()));
    }
    @PostMapping("/custom-skills") @ResponseStatus(HttpStatus.CREATED)
    public AccountSkillService.CustomSkill create(@AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody NameInput input) {
        return skills.create(user.id(), input.name());
    }
    @PutMapping("/custom-skills/{id}")
    public AccountSkillService.CustomSkill update(@AuthenticationPrincipal CurrentUser user,
            @PathVariable long id, @Valid @RequestBody CustomInput input) {
        return skills.update(user.id(), id, input.name(), input.proficiencyLevel());
    }
    @PostMapping("/custom-skills/from-legacy/{skillId}") @ResponseStatus(HttpStatus.CREATED)
    public AccountSkillService.CustomSkill convertLegacy(@AuthenticationPrincipal CurrentUser user,
            @PathVariable long skillId, @Valid @RequestBody CustomInput input) {
        return skills.convertLegacy(user.id(), skillId, input.name(), input.proficiencyLevel());
    }
    @DeleteMapping("/custom-skills/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCustom(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        skills.deleteCustom(user.id(), id);
    }
    @GetMapping("/ai-skill-candidates")
    public CandidateList candidates(@AuthenticationPrincipal CurrentUser user) {
        return new CandidateList(skills.candidates(user.id()));
    }
    @DeleteMapping("/ai-skill-candidates/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCandidate(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        skills.deleteCandidate(user.id(), id);
    }
}
