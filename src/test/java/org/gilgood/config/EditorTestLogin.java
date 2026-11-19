package org.gilgood.config;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.OidcLoginRequestPostProcessor;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;

public final class EditorTestLogin {
    private EditorTestLogin() {
    }

    public static OidcLoginRequestPostProcessor editorLogin() {
        return oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_EDITOR"));
    }
}
