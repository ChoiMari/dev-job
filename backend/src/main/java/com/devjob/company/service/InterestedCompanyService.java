package com.devjob.company.service;

import com.devjob.company.dto.*;
import com.devjob.company.entity.InterestedCompany;
import com.devjob.company.repository.InterestedCompanyRepository;
import com.devjob.user.repository.UserRepository;
import jakarta.validation.Validator;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InterestedCompanyService {
    private final InterestedCompanyRepository companies;
    private final UserRepository users;
    private final Validator validator;
    public InterestedCompanyService(InterestedCompanyRepository companies, UserRepository users, Validator validator) {
        this.companies = companies; this.users = users; this.validator = validator;
    }
    @Transactional(readOnly = true)
    public Page<CompanyResponse> list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw error(HttpStatus.BAD_REQUEST);
        return companies.findByUser_Id(userId, PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt", "id"))).map(CompanyResponse::from);
    }
    @Transactional(readOnly = true)
    public CompanyResponse get(Long userId, Long id) { return CompanyResponse.from(owned(userId, id, false)); }
    @Transactional
    public CompanyResponse create(Long userId, CompanyInput input) {
        validate(input);
        String url = website(input.websiteUrl());
        var user = users.findById(userId).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED));
        try {
            return CompanyResponse.from(companies.saveAndFlush(new InterestedCompany(user, input, url)));
        } catch (DataIntegrityViolationException exception) { throw error(HttpStatus.CONFLICT); }
    }
    @Transactional
    public CompanyResponse update(Long userId, Long id, CompanyPatch patch) {
        var company = owned(userId, id, true);
        var input = patch.merge(CompanyResponse.from(company));
        validate(input);
        String url = website(input.websiteUrl());
        company.update(input, url);
        try { companies.flush(); }
        catch (DataIntegrityViolationException exception) { throw error(HttpStatus.CONFLICT); }
        return CompanyResponse.from(company);
    }
    @Transactional
    public void delete(Long userId, Long id) {
        companies.delete(owned(userId, id, true));
        companies.flush();
    }
    private InterestedCompany owned(Long userId, Long id, boolean lock) {
        if (id == null || id <= 0) throw error(HttpStatus.BAD_REQUEST);
        var company = (lock ? companies.findForUpdate(id) : companies.findById(id))
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (!company.getUserId().equals(userId)) throw error(HttpStatus.FORBIDDEN);
        return company;
    }
    private void validate(CompanyInput input) {
        if (!validator.validate(input).isEmpty()) throw error(HttpStatus.BAD_REQUEST);
    }
    private String website(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            URI uri = new URI(value.strip());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                    || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) throw error(HttpStatus.BAD_REQUEST);
            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            int port = uri.getPort();
            if (port == 80 && normalizedScheme.equals("http") || port == 443 && normalizedScheme.equals("https")) port = -1;
            String path = uri.getRawPath();
            if ("/".equals(path)) path = null;
            String origin = new URI(normalizedScheme, null, host.toLowerCase(Locale.ROOT), port,
                    null, null, null).toASCIIString();
            String normalized = origin + (path == null ? "" : path) + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
            if (normalized.length() > 2048) throw error(HttpStatus.BAD_REQUEST);
            return normalized;
        } catch (URISyntaxException exception) { throw error(HttpStatus.BAD_REQUEST); }
    }
    private ResponseStatusException error(HttpStatus status) { return new ResponseStatusException(status); }
}
