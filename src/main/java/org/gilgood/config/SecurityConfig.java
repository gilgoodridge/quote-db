package org.gilgood.config;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.authority.mapping.GrantedAuthoritiesMapper;
import org.springframework.security.oauth2.core.oidc.user.OidcUserAuthority;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Arrays;
import java.util.HashSet;
import java.util.stream.Collectors;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http, @Value("${app.frontend-url}") String frontendUrl,
            GrantedAuthoritiesMapper editorAuthoritiesMapper) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                        .requestMatchers("/api/candidate-authors/*/promote", "/api/candidate-authors/*/link",
                                "/api/candidate-quotes/*/promote").hasRole("EDITOR")
                        .requestMatchers("/api/candidates/batch",
                                "/api/candidate-authors", "/api/candidate-authors/**",
                                "/api/candidate-quotes", "/api/candidate-quotes/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/me", "/api/auth/csrf",
                                "/api/authors", "/api/authors/**", "/api/quotes", "/api/quotes/**", "/api/categories",
                                "/api/characters", "/api/characters/**",
                                "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/authors", "/api/authors/**",
                                "/api/quotes", "/api/quotes/**", "/api/categories",
                                "/api/characters", "/api/characters/**").permitAll()
                        .requestMatchers("/api/**").hasRole("EDITOR")
                        .anyRequest().denyAll())
                .requestCache(cache -> cache.disable())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(401);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Login required\"}");
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(403);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\":\"Access denied or invalid CSRF token\"}");
                        }))
                .oauth2Login(login -> login
                        .userInfoEndpoint(userInfo -> userInfo.userAuthoritiesMapper(editorAuthoritiesMapper))
                        .defaultSuccessUrl(frontendUrl, true)
                        .failureUrl(frontendUrl + "/?login=error"))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)));
        return http.build();
    }

    @Bean
    public GrantedAuthoritiesMapper editorAuthoritiesMapper(
            @Value("${app.security.editor-subjects:}") String editorSubjects) {
        var subjects = Arrays.stream(editorSubjects.split(","))
                .map(String::trim)
                .filter(subject -> !subject.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
        return authorities -> {
            var mapped = new HashSet<GrantedAuthority>(authorities);
            for (var authority : authorities) {
                if (authority instanceof OidcUserAuthority oidc
                        && oidc.getIdToken().getIssuer() != null
                        && "https://accounts.google.com".equals(oidc.getIdToken().getIssuer().toString())
                        && subjects.contains(oidc.getIdToken().getSubject())) {
                    mapped.add(new SimpleGrantedAuthority("ROLE_EDITOR"));
                }
            }
            return mapped;
        };
    }
}
