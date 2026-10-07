package com.devjob.auth.config;

import com.devjob.common.error.ApiError;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean HttpSessionCsrfTokenRepository csrfTokenRepository() { return new HttpSessionCsrfTokenRepository(); }
    @Bean HttpSessionSecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper json,
            HttpSessionCsrfTokenRepository csrf, HttpSessionSecurityContextRepository contexts,
            ObjectProvider<UserRepository> users) throws Exception {
        http.authorizeHttpRequests(access -> access
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/auth/csrf").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                .anyRequest().authenticated())
            .csrf(config -> config.csrfTokenRepository(csrf))
            .securityContext(config -> config.securityContextRepository(contexts).requireExplicitSave(true))
            .requestCache(config -> config.disable())
            .formLogin(config -> config.disable())
            .httpBasic(config -> config.disable())
            .logout(config -> config.disable())
            .exceptionHandling(config -> config
                .authenticationEntryPoint((request, response, exception) -> writeError(response, json, 401))
                .accessDeniedHandler((request, response, exception) -> writeError(response, json,
                        unauthenticatedProtectedRequest(request) ? 401 : 403)));
        var userRepository = users.getIfAvailable();
        if (userRepository != null) {
            http.addFilterAfter(new CredentialVersionFilter(userRepository, json), SecurityContextHolderFilter.class);
        }
        return http.build();
    }

    private boolean unauthenticatedProtectedRequest(HttpServletRequest request) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean anonymous = authentication == null || authentication instanceof AnonymousAuthenticationToken;
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return anonymous && !path.equals("/api/auth/register") && !path.equals("/api/auth/login");
    }

    private void writeError(HttpServletResponse response, ObjectMapper json, int status) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        json.writeValue(response.getWriter(), status == 401
                ? new ApiError("UNAUTHORIZED", "로그인이 필요합니다.")
                : new ApiError("FORBIDDEN", "접근 권한이 없습니다."));
    }

    private static final class CredentialVersionFilter extends OncePerRequestFilter {
        private final UserRepository users;
        private final ObjectMapper json;

        private CredentialVersionFilter(UserRepository users, ObjectMapper json) {
            this.users = users;
            this.json = json;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                FilterChain chain) throws ServletException, IOException {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            if (!path.startsWith("/api/") || path.equals("/api/auth/csrf")
                    || path.equals("/api/auth/login") || path.equals("/api/auth/register")) {
                chain.doFilter(request, response);
                return;
            }
            var session = request.getSession(false);
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            if (session != null && authentication != null
                    && authentication.getPrincipal() instanceof CurrentUser user) {
                Object storedVersion = session.getAttribute("DEVJOB_CREDENTIAL_VERSION");
                long sessionVersion = storedVersion instanceof Long version ? version : 0L;
                var account = users.findById(user.id());
                if (account.isEmpty() || account.get().getCredentialVersion() != sessionVersion) {
                    session.invalidate();
                    SecurityContextHolder.clearContext();
                    response.setStatus(401);
                    response.setContentType("application/json;charset=UTF-8");
                    json.writeValue(response.getWriter(), new ApiError("UNAUTHORIZED", "로그인이 필요합니다."));
                    return;
                }
            }
            chain.doFilter(request, response);
        }
    }
}
