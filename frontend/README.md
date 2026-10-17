# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Google sign-in

The header hamburger menu includes **Login** above **About** when signed out and
shows the signed-in account with **Logout** when authenticated. The native login
dialog offers **Continue with Google** and **Keep browsing**; public browsing
remains available if session checks or logout fail. The dialog supports Escape,
keeps keyboard focus within the modal, and returns focus to the hamburger button
when closed.

The Google button navigates to the backend's
`/oauth2/authorization/google` endpoint. On returning to the frontend root,
`?login=error` displays a sign-in error and is removed from the address bar
without changing other query parameters or the URL hash.

The frontend uses `VITE_API_URL` as its API base (default `/api`). Set it to the
backend API URL when the frontend and backend have different origins, for
example `http://localhost:8080/api`. The OAuth start URL uses that API URL's
origin; for a relative API base it uses the current frontend origin.

All API requests include credentials. Mutating requests first fetch a fresh
CSRF token and use the response's `headerName` and `token`. Authentication is
session-cookie based; the frontend does not store credentials or session data
in local storage. The backend provides `GET /api/auth/me`,
`GET /api/auth/csrf`, and `POST /api/auth/logout` (204 on success).

Run the API contract tests with `npm test`.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
