package com.devjob.company.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.company.dto.*;
import com.devjob.company.service.InterestedCompanyService;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/companies")
public class InterestedCompanyController {
    private final InterestedCompanyService companies;
    public InterestedCompanyController(InterestedCompanyService companies) { this.companies = companies; }
    public record CompanyPage(List<CompanyResponse> items, int page, int size, long totalElements) { }
    @GetMapping public CompanyPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        var result = companies.list(user.id(), page, size);
        return new CompanyPage(result.getContent(), page, size, result.getTotalElements());
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public CompanyResponse create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody CompanyInput input) {
        return companies.create(user.id(), input);
    }
    @GetMapping("/{companyId}")
    public CompanyResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long companyId) {
        return companies.get(user.id(), companyId);
    }
    @PatchMapping("/{companyId}")
    public CompanyResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable Long companyId,
            @RequestBody JsonNode body) {
        return companies.update(user.id(), companyId, CompanyPatch.from(body));
    }
    @DeleteMapping("/{companyId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long companyId) {
        companies.delete(user.id(), companyId);
    }
}
