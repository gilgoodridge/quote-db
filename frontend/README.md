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

Run API contract tests and component interaction tests with `npm test`.
Component tests use Vitest, Testing Library, and jsdom. Run `npm run lint` and
`npm run build` for linting and the production bundle.

## Quote pagination

The middle panel loads one quote page at a time via `api.quotes.listPage`.
Previous/Next controls appear at the bottom with one-based page labels.
Quotes per page offers 10, 20 (default), 50, and 100. Changing the size or
author/search/category filters resets the API page to 0 and retains the chosen
size. Failed loads can be retried; outdated responses are ignored. Quote writes
refresh the current page and totals, moving back if that page no longer exists.
The Authors sidebar loads 10 authors at a time with a More authors action.
Author pickers elsewhere still collect all pages.

## Author search

The Authors section has a compact search field above the author list. Press
Enter or click its search icon to submit immediately, or pause typing for
**500 ms** to search automatically. Further typing restarts the delay;
clearing the field immediately restores the first unfiltered page. The backend's optional
`query` parameter performs case-insensitive substring matching on **fullName
only**, not `knownAs`, with trimmed, literal text (no wildcard syntax or quote
FULLTEXT stemming). Labels still prefer `knownAs`; results remain ID ascending.

`api.authors.list(query = '')` collects all matching pages, retaining the query
on every request. `api.authors.listPage({query, page, size})` returns a single
page with filtered totals. Existing author pickers call `list()` without a query
and still load the complete catalog.

The sidebar uses `api.authors.listPage({query, page: 0, size: 10})` initially.
**More authors** at the bottom of the list appends the next 10 matches, retaining
the query, and disappears after the last page. Loading more keeps existing
authors visible, disables duplicate requests, and offers retry for failures on
the same page. Searches, clearing, and author refreshes reset to the first page;
outdated initial and more-page responses cannot populate a newer search.

Search only narrows this list: it does not change the selected author or quote
text/category filters, even if the selected author is no longer visible.
All authors still clears only the author selection. Creation and editing
refreshes preserve the author query while resetting the list to its first page. Loading and no-match states are distinct
from visible failures; Retry or resubmission retries the current query without
losing the field text. Outdated responses are ignored. The field uses theme
variables for light/dark mode and fits narrow sidebar widths.

## Quote categories
Add Quote and Edit Quote load `/api/categories` and offer optional multi-select
checkbox groups for Tone, Theme, Form, and Source. Options use server-provided
IDs and labels, not a hardcoded catalog. Every group shows its selection count
and has a Clear action. All groups may be empty.

Editing prefills current categories. Every save submits `toneIds`, `themeIds`,
`formIds`, and `sourceIds`, preserving selections when other fields change and
explicitly sending `[]` when a group is cleared. Category loading failures offer
Retry and keep the draft; Save is disabled until loading succeeds. Write failures
keep selections and entered values.

Expanded quote details display selected labels grouped by dimension for public
and signed-in browsing, including search results. Empty groups are hidden.
Hover over checkbox labels or selected tags for backend-provided scope
descriptions. These descriptions also support screen readers. Descriptions
require backend V7; older responses without them still support editing.
Category controls and tags wrap for mobile widths and use the existing theme
variables for light and dark modes. Source identifies the origin type, while
Location remains the precise location. Category filtering is not implemented.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
