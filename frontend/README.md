# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Google sign-in

The header hamburger menu includes **Login** above **About** when signed out and
shows the signed-in account with **Logout** when authenticated. The native login
dialog offers **Continue with Google** and a top-right **×** to close; public browsing
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

## Candidate review

The right panel shows **Candidate review** near the top only while signed in;
otherwise it retains **Coming Soon**, also top-aligned. **Review next candidate** requests the oldest pending quote
with `status=PENDING&page=0&size=1`. Empty queues and retryable load failures are
shown separately. The panel loads and displays total pending quote and author
counts on sign-in, and refreshes them after candidate review updates; count
failures are visible and retryable. It does not automatically open a candidate.

An APPROVED candidate author with a `publishedAuthorId` is preselected. Otherwise,
the candidate name is searched before **Review author** opens. An exact,
case-insensitive match on full name or known-as name prompts the reviewer to
choose an existing author or create a new one. **View author details** opens a
read-only view before linking; **Use this author** links and approves the
candidate author without creating another record. Search failures stay visible
and retryable. If there is no match, the shared author form opens as **Review
author**, prefilled with the candidate name. Edit the name and fill the existing
required birth date, then **Save author** to create the author and link/approve
the candidate author. Closing the author prompt/form continues to **Review Quote**
with an empty author picker.

Review Quote reuses Add Quote's author/character pickers, categories, validation,
and retryable option loads, with candidate text and source URL prefilled. The
Reference field has an external-link icon for HTTP/HTTPS URLs, opening a new tab.
Published references remain limited to 255 characters. **Approve** publishes the
quote, then links and approves its candidate. **Reject** updates only the
candidate status, preserving stored text/link rather than draft edits, and does
not require an author or loaded form options. The top-right close button cancels.
After successful approval or rejection, the next pending candidate opens
automatically. Empty queues and retryable next-item failures appear in the panel;
cancellation or failed approval/rejection does not advance the queue.
An author already saved is not deleted by cancelling/rejecting the quote.

Publication and candidate approval are separate requests. After partial success,
the saved form is locked and a retry updates only the candidate; quote rejection
is disabled once published. Published IDs survive closing/reopening a review
in the current signed-in page session, not reload/logout. See the root README's
atomic-promotion TODO for concurrency and ambiguous-response limitations. The
queue is not reserved across reviewers. Successful publication refreshes sidebar
names/quotes without changing browsing filters. Candidate backend endpoints remain
temporarily anonymous with CSRF on writes; this signed-in UI is not an API access
restriction.

## Quote pagination

The middle panel loads one quote page at a time via `api.quotes.listPage`.
Previous/Next controls appear at the bottom with one-based page labels.
Quotes per page offers 10, 20 (default), 50, and 100. Changing the size or
author/character/search/category filters resets the API page to 0 and retains the chosen
size. Failed loads can be retried; outdated responses are ignored. Quote writes
refresh the current page and totals, moving back if that page no longer exists.
The sidebar loads 10 authors and 10 characters independently, with More authors
and More characters actions. Quote form pickers collect all pages.

## Quote attribution

Every quote shows its author beneath the quote, using `knownAs` when available
or `fullName` otherwise. Quotes with a character instead use a single line:
character in *work title* by author. Work titles are italicized; if absent,
the "in work title" phrase is omitted.

Author and character names are keyboard-accessible buttons opening public
details dialogs without expanding the quote or changing filters. Attribution
is identical for all filter combinations; selecting an author or character
never adds a heading above the results. Signed-in users can edit details;
successful edits refresh the sidebar and quote attribution without clearing filters.

## Author search

The Authors section has a compact search field above the author list. Press
Enter or click its search icon to submit immediately, or pause typing for
**500 ms** to search automatically. Further typing restarts the delay;
clearing the field immediately restores the first unfiltered page. The backend's optional
`query` parameter performs case-insensitive substring matching on **fullName
or knownAs**, with trimmed, literal text (no wildcard syntax or quote
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

Search only narrows this list: it does not change selected author/character IDs or
quote text/category filters, even if the selected author is no longer visible.
Clicking a selected author or character again clears only that selection.
The scroll areas target about five authors and three characters: the author
height limit is 5/6 of its previous size, and the character limit is 3/5 of
the author limit. The same proportions apply on mobile; short screens and
wrapped names may show fewer entries.
Creation and editing
refreshes preserve the author query while resetting the list to its first page. Loading and no-match states are distinct
from visible failures; Retry or resubmission retries the current query without
losing the field text. Outdated responses are ignored. The field uses theme
variables for light/dark mode and fits narrow sidebar widths.

## Characters

Characters are optional fictional speakers; every quote still requires its
writer as the author. The Characters filter uses the shared `NameFilter`
component with the same independent full-name search, 500 ms debounce,
10-item paging, clearing, retry and stale-response handling as Authors.
Selecting a character combines with author, quote-text and category filters
using AND, with pagination and counts applied in the backend.

`api.characters.list(query = '')` collects all matching pages;
`listPage({query, page, size})` returns one page. Filter and picker labels prefer
`knownAs` and append `workTitle` in parentheses to distinguish names from
different works. Sidebar Info buttons next to authors and characters open
their respective details dialogs. `AboutAuthorDialog` shows author identity,
dates, birthplace, nationality, biography and age when available;
`AboutCharacterDialog` shows full name, known-as name, work title and
description. Missing values are marked Not provided.

Signed-in users can create characters from the quote form and edit them from
details. The sidebar lists and filters characters but does not offer creation.
`AddCharacterDialog` requires a full name (255 characters
maximum); known-as name and work title are optional (255 each), and description
is optional (1024). Saves trim text and send cleared optional fields as null
using full-replacement PUT semantics. Failed saves retain drafts; saving blocks
duplicate submissions and dismissal. Native dialogs restore focus on close.
Character deletion is not exposed in the frontend.

Add Quote preselects the current author/character filters. Edit Quote preserves
the existing character, including on scalar-only edits. Every quote save sends
`characterId`, or null for No character / narration. Character options load
through the all-pages API helper; loading failures are visible and retryable,
and Save stays disabled until loading succeeds. Unavailable assignments are
never silently cleared. Nested character creation selects the saved character
without discarding quote fields or categories; cancelling the quote does not
delete an already-created character.

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
Location remains the precise location. Sidebar category filters match any
selected ID within a dimension and combine dimensions with author, character
and quote-text filters using AND.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
