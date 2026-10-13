package com.devjob.company.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.company.service.CompanyTagService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/company-tags")
public class CompanyTagController {
    public record TagInput(@NotBlank @Size(max = 20) String name, @NotBlank String colorKey) { }
    public record OrderInput(@NotEmpty List<Long> tagIds) { }
    private final CompanyTagService tags;
    public CompanyTagController(CompanyTagService tags) { this.tags = tags; }

    @GetMapping public List<CompanyTagService.Tag> list(@AuthenticationPrincipal CurrentUser user) {
        return tags.list(user.id());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CompanyTagService.Tag create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody TagInput input) {
        return tags.create(user.id(), input.name(), input.colorKey());
    }
    @PatchMapping("/{tagId}")
    public CompanyTagService.Tag update(@AuthenticationPrincipal CurrentUser user, @PathVariable long tagId,
            @Valid @RequestBody TagInput input) {
        return tags.update(user.id(), tagId, input.name(), input.colorKey());
    }
    @PutMapping("/order")
    public List<CompanyTagService.Tag> reorder(@AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody OrderInput input) {
        return tags.reorder(user.id(), input.tagIds());
    }
    @DeleteMapping("/{tagId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long tagId) {
        tags.delete(user.id(), tagId);
    }
}
