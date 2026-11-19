package org.gilgood.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.gilgood.dto.CsrfResponse;
import org.gilgood.dto.SessionUserResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @GetMapping("/me")
    public ResponseEntity<SessionUserResponse> currentUser(
            @AuthenticationPrincipal OidcUser user, HttpServletRequest request) {
        SessionUserResponse response = user == null
                ? new SessionUserResponse(false, false, null, null, null)
                : new SessionUserResponse(true, request.isUserInRole("EDITOR"),
                        user.getFullName(), user.getEmail(), user.getSubject());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response);
    }

    @GetMapping("/csrf")
    public ResponseEntity<CsrfResponse> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(token.getToken(), token.getHeaderName()));
    }
}
