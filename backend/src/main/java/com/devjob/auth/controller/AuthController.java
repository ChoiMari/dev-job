package com.devjob.auth.controller;

import com.devjob.auth.dto.Credentials;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.auth.dto.PasswordChangeRequest;
import com.devjob.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final HttpSessionSecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrf;

    public AuthController(AuthService auth, HttpSessionSecurityContextRepository contexts,
            HttpSessionCsrfTokenRepository csrf) {
        this.auth = auth;
        this.contexts = contexts;
        this.csrf = csrf;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) { return new CsrfResponse(token.getHeaderName(), token.getToken()); }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public CurrentUser register(@Valid @RequestBody Credentials credentials) { return auth.register(credentials); }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody Credentials credentials,
            HttpServletRequest request, HttpServletResponse response) {
        var sessionLogin = auth.authenticateSession(credentials);
        var user = sessionLogin.user();
        var authentication = UsernamePasswordAuthenticationToken.authenticated(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        if (request.getSession(false) != null) request.changeSessionId();
        new CsrfAuthenticationStrategy(csrf).onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        request.getSession().setAttribute("DEVJOB_CREDENTIAL_VERSION", sessionLogin.credentialVersion());
        return new LoginResponse(user);
    }

    @GetMapping("/me")
    public CurrentUser me(@AuthenticationPrincipal CurrentUser user) { return auth.current(user.id()); }

    @PatchMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody PasswordChangeRequest body,
            HttpServletRequest request, HttpServletResponse response) {
        auth.changePassword(user.id(), body);
        logout(request, response);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        new CookieClearingLogoutHandler("JSESSIONID").logout(request, response, authentication);
    }

    public record LoginResponse(CurrentUser user) { }
    public record CsrfResponse(String headerName, String token) { }
}
