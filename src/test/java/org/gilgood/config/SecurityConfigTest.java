package org.gilgood.config;

import org.gilgood.controller.AuthController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AuthController.class, SecurityConfigTest.Resources.class},
        properties = "app.frontend-url=http://localhost:5173")
@Import({SecurityConfig.class, CorsConfig.class, SecurityConfigTest.Clients.class,
        SecurityConfigTest.Resources.class})
class SecurityConfigTest {
    @Autowired
    private MockMvc mvc;

    @Test
    void anonymousCanBrowseAndCheckSession() throws Exception {
        mvc.perform(get("/api/authors")).andExpect(status().isOk());
        mvc.perform(get("/api/quotes")).andExpect(status().isOk());
        mvc.perform(head("/api/authors/1")).andExpect(status().isOk());
        mvc.perform(head("/api/quotes/1")).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void exposesOnlySessionProfileNotTokens() throws Exception {
        mvc.perform(get("/api/auth/me").with(oidcLogin().idToken(token -> token
                        .claim("name", "Test User").claim("email", "test@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.idToken").doesNotExist())
                .andExpect(jsonPath("$.accessToken").doesNotExist());
    }

    @Test
    void writesRequireLoginAndCsrfForBothResources() throws Exception {
        for (String path : new String[]{"/api/authors", "/api/authors/1", "/api/quotes", "/api/quotes/1"}) {
            for (String method : new String[]{"POST", "PUT", "DELETE"}) {
                mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method), path).with(csrf()))
                        .andExpect(status().isUnauthorized());
                mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method), path).with(oidcLogin()))
                        .andExpect(status().isForbidden());
                mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method), path)
                                .with(oidcLogin()).with(csrf()))
                        .andExpect(status().isOk());
            }
        }
    }

    @Test
    void csrfEndpointProvidesUsableSessionBoundToken() throws Exception {
        var result = mvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andReturn();
        CsrfToken token = (CsrfToken) result.getRequest().getAttribute(CsrfToken.class.getName());
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(post("/api/authors").session(session).with(oidcLogin())
                        .header(token.getHeaderName(), token.getToken()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/authors").with(oidcLogin())
                        .header(token.getHeaderName(), token.getToken()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/authors").session(session).with(oidcLogin()).with(csrf().useInvalidToken()))
                .andExpect(status().isForbidden());
    }

    @Test
    void credentialedCorsAllowsOnlyConfiguredOrigins() throws Exception {
        mvc.perform(options("/api/authors").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,x-csrf-token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/authors").header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void logoutRequiresCsrfAndInvalidatesSession() throws Exception {
        mvc.perform(post("/api/auth/logout").with(oidcLogin())).andExpect(status().isForbidden());
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/auth/logout").session(session).with(oidcLogin()).with(csrf()))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge("JSESSIONID", 0));
        assertTrue(session.isInvalid());
        mvc.perform(get("/api/auth/me")).andExpect(jsonPath("$.authenticated").value(false));
        mvc.perform(get("/api/auth/logout")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginRedirectsToGoogleAndInvalidCallbackReturnsToFrontend() throws Exception {
        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", startsWith("https://accounts.google.com/")))
                .andExpect(header().string("Location",
                        containsString("redirect_uri=http://localhost/login/oauth2/code/google")));
        mvc.perform(get("/login/oauth2/code/google").param("error", "access_denied"))
                .andExpect(redirectedUrl("http://localhost:5173/?login=error"));
    }

    @RestController
    static class Resources {
        @RequestMapping(value = {"/api/authors", "/api/authors/1", "/api/quotes", "/api/quotes/1"},
                produces = MediaType.APPLICATION_JSON_VALUE)
        String resource() {
            return "[]";
        }
    }

    @TestConfiguration
    static class Clients {
        @Bean
        ClientRegistrationRepository clientRegistrationRepository() {
            return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google")
                    .clientId("test-client").clientSecret("test-secret")
                    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                    .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                    .scope("openid", "email", "profile")
                    .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                    .tokenUri("https://oauth2.googleapis.com/token")
                    .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                    .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
                    .userNameAttributeName("sub").clientName("Google").build());
        }
    }
}
