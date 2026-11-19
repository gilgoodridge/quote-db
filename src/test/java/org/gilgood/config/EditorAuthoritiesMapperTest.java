package org.gilgood.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUserAuthority;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EditorAuthoritiesMapperTest {
    private static final SimpleGrantedAuthority EDITOR = new SimpleGrantedAuthority("ROLE_EDITOR");

    @Test
    void mapsOnlyAllowlistedGoogleSubjectsAndPreservesExistingAuthorities() {
        var mapper = new SecurityConfig().editorAuthoritiesMapper(" editor-one, ,editor-two,editor-one ");
        var identity = identity("https://accounts.google.com", "editor-two");
        var scope = new SimpleGrantedAuthority("SCOPE_openid");
        var mapped = mapper.mapAuthorities(List.of(identity, scope));
        assertTrue(mapped.contains(EDITOR));
        assertTrue(mapped.contains(identity));
        assertTrue(mapped.contains(scope));
        assertFalse(mapper.mapAuthorities(List.of(identity("https://accounts.google.com", "editor"))).contains(EDITOR));
        assertFalse(mapper.mapAuthorities(List.of(identity("https://another-provider.example", "editor-two")))
                .contains(EDITOR));
        assertFalse(mapper.mapAuthorities(List.of(identity("https://accounts.google.com", "EDITOR-TWO")))
                .contains(EDITOR));
    }

    @Test
    void emptyAllowlistAndEmailMatchesDoNotGrantEditing() {
        var identity = identity("https://accounts.google.com", "not-allowlisted");
        assertFalse(new SecurityConfig().editorAuthoritiesMapper(" , ")
                .mapAuthorities(List.of(identity)).contains(EDITOR));
        assertFalse(new SecurityConfig().editorAuthoritiesMapper("editor@example.com")
                .mapAuthorities(List.of(identity)).contains(EDITOR));
    }

    private OidcUserAuthority identity(String issuer, String subject) {
        return new OidcUserAuthority(OidcIdToken.withTokenValue("test-token")
                .issuer(issuer).subject(subject).claim("email", "editor@example.com").build());
    }
}
