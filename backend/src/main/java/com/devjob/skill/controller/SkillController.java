package com.devjob.skill.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.skill.dto.*;
import com.devjob.skill.service.SkillService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SkillController {
    private final SkillService skills;
    public SkillController(SkillService skills) { this.skills = skills; }
    public record SkillList(List<SkillResponse> items) { }
    public record SkillPage(List<SkillResponse> items, int page, int size, long totalElements) { }
    @GetMapping("/skills")
    public SkillPage search(@RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = skills.search(q, page, size);
        return new SkillPage(result.getContent(), page, size, result.getTotalElements());
    }
    @GetMapping("/me/skills")
    public SkillList list(@AuthenticationPrincipal CurrentUser user) { return new SkillList(skills.list(user.id())); }
    @PostMapping("/me/skills") @ResponseStatus(HttpStatus.CREATED)
    public SkillResponse add(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody AddSkillRequest input) {
        return skills.add(user.id(), input);
    }
    @DeleteMapping("/me/skills/{skillId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long skillId) { skills.delete(user.id(), skillId); }
}
