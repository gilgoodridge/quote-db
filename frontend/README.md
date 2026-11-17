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
pending quote, snoozed quote, and pending author counts on sign-in, and refreshes them after candidate review updates; count
failures are visible and retryable. It does not automatically open a candidate.
**Snooze** marks a pending quote `SNOOZED` without saving draft edits or
publishing it, removing it from the pending queue. **Review snoozed** loads the
oldest snoozed quote with `status=SNOOZED&page=0&size=1`. Approval or rejection
continues within the queue currently being reviewed; closing a snoozed review
leaves the quote snoozed.

An APPROVED candidate author with a `publishedAuthorId` is preselected. Otherwise,
the candidate name is searched before **Review author** opens. An exact,
case-insensitive match on full name or known-as name prompts the reviewer to
choose an existing author or create a new one. **View author details** opens a
read-only view before linking; **Use this author** links and approves the
candidate author without creating another record. Search failures stay visible
and retryable. If there is no match, the shared author form opens as **Review
author**, prefilled with the candidate name. Edit the name and fill the existing
required birth date, then **Save author** to create the author and link/approve
the candidate author. **Snooze quotes** marks every quote candidate linked to
that author `SNOOZED` and leaves the author pending. **Reject author and quotes**
marks the author and all its quote candidates `REJECTED`. Both actions preserve
quote text and any published quote links, do not delete data, and continue with
the pending quote queue. They are also available when an existing-author match
is shown. Closing the author prompt/form continues to **Review Quote** with an
empty author picker.

Review Quote reuses Add Quote's author/character pickers, categories, validation,
and retryable option loads, with candidate text and source URL prefilled. The
Primary and secondary reference fields have external-link icons for HTTP/HTTPS URLs, opening a new tab.
Published references remain limited to 255 characters. **Approve** atomically
publishes the quote and approves its candidate. **Reject** updates only the
candidate status, preserving stored text/link rather than draft edits, and does
not require an author or loaded form options. **Snooze** likewise preserves stored
text/link and does not require the quote form options. The top-right close button
cancels. After successful approval or rejection, the next candidate in the
current queue opens automatically. Empty queues and retryable next-item failures appear in the panel;
cancellation or failed approval/rejection does not advance the queue.
An author already saved is not deleted by cancelling/rejecting the quote.

Review actions also appear in the fixed title bar and remain visible while
scrolling. Both copies share validation and saving/retry state; Snooze is only
available for pending candidates. Create/Edit Quote keep actions at the bottom only.

Promotion runs transactionally on the backend. Candidate-row locks serialize
concurrent promotions, and retrying an ambiguous request returns the already
linked published record rather than creating a duplicate. After an ambiguous
network or server failure, the form locks the submitted fields and retries the
same payload; reject/snooze are disabled until its outcome is known. A definite
client error leaves the form editable. The queue is not reserved across reviewers.
Successful publication refreshes sidebar
names/quotes without changing browsing filters. Candidate reads, imports, and
review-field updates remain temporarily anonymous with CSRF on writes; promotion
endpoints require authentication and CSRF because they create published content.

## Deleting quotes linked to candidates

After normal quote-delete confirmation, the specific HTTP 409 Problem Details
code `QUOTE_LINKED_TO_CANDIDATES` opens a native recovery dialog. The API client
reads RFC 9457 `application/problem+json` errors and exposes `status`, `code`
and `type`, while retaining support for existing plain-text errors. Never match
error prose or treat every 409 as a candidate-link conflict.

Choose **Reject candidates and delete quote** or **Return candidates to Pending
and delete quote**, or cancel without changes. The selected status is sent as
`candidateStatus=REJECTED` or `PENDING` on the authenticated, CSRF-protected quote
DELETE. The backend updates all linked candidates, clears their published-quote
links and deletes the quote in one transaction, rolling everything back on
failure. Candidate text, source information, candidate-author links and published
authors/characters are preserved. Saving blocks duplicate actions and dismissal;
errors keep the dialog retryable. Cancellation restores focus to Delete, success
to the quotes container. Successful recovery refreshes quote totals and pending
candidate counts, and discards cached publication IDs for the deleted quote so
Pending candidates can be reviewed again.

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

### Dialog conventions

Quote, author and character create/edit/review forms use compact labels:
mandatory fields have ` *`, not `(required)`/`(optional)`, while native required
validation remains active. Field-label hovertext replaces introductory guidance;
author/character descriptions live in their shared field definitions. Character
guidance distinguishes the fictional speaker from the author. Known as controls
the display name when provided.

Use the shared fixed `DialogHeader` outside the scrolling body, with its top-right
close button and 16px of space above the first field. Keep create/edit actions at
the bottom; only Review Quote duplicates its actions in the title bar, sharing
validation and saving/retry state. Category groups start collapsed, expand
independently, and retain visible selection counts and stored selections.

New authors and characters are saved immediately, even if the quote is later
cancelled. Editing replaces all details and clears optional fields left empty.
Keep visible retryable errors, failed drafts, focus restoration and saving guards.
Use theme variables and wrapping so dialogs remain usable on narrow screens.

Create, edit and review author forms have **Look up with AI** beside Date of
birth, Date of death, Place of birth and Biography. Enter a full name, then click
to request a Gemini suggestion through `api.ai.lookup(type, {fullName})`, using
`AUTHOR_DATE_OF_BIRTH`, `AUTHOR_DATE_OF_DEATH`, `AUTHOR_PLACE_OF_BIRTH` or
`AUTHOR_BIOGRAPHY` (`POST /api/ai/lookups`,
session cookies and fresh CSRF required). Requests use `{type, context}`; replies
use `{status: 'FOUND', value: '...'}` (ISO `YYYY-MM-DD` for dates, text otherwise)
or `{status: 'UNKNOWN'}`.
Only the name is sent to Google, via the backend. The single typed endpoint is
shared infrastructure for future author/quote lookups; unsupported types return 400.
A suggestion populates only the selected editable field without saving or
changing other fields. Date of death, birthplace and biography remain optional. Living authors and
unconfirmed deaths should return UNKNOWN, never predicted or burial dates.
Verify suggestions before
saving, since the prompt's 99.9% confidence request is not an accuracy guarantee.
Birthplace requests 99% confidence and prefers city/town, administrative divisions
and country. Uncertain components may be omitted, including the country, so
verify potentially ambiguous locations. The prompt requests nothing more
specific than the city or town and returns UNKNOWN for ambiguous identities or
entirely unknown birthplaces. Biography requests factual,
professional, neutral prose: one paragraph, no more than three sentences, excluding
controversies, the person's name/aliases, birth/death dates or years, and birthplace.
An encyclopedia-style opening may be a sentence fragment rather than an awkward
complete sentence that attributes the person's achievements to anyone in that role.
All prompts refer to a person rather than assuming a writing profession.
Biography asks Gemini to do its best with reliable known facts, without an IDK
option or confidence threshold; date and birthplace confidence rules are unchanged.
Location text is limited to 255 characters, biography to 1024. The backend rejects
invalid length/paragraph/sentence structure without truncation. Content rules are
prompt-based and still need editorial verification.
If Gemini is unsure, the dialog says so and leaves the field unchanged. Quota,
configuration, network and provider/response failures are visible and retryable
without losing the draft. During lookup, fields, Save and review mutations are
disabled, but Close/Cancel still work; responses after unmount are ignored.
Published-author and ambiguous-promotion-retry locks also disable lookup.

Set `GEMINI_API_KEY` only in the backend environment, never in `VITE_*` variables
or source control, and restart the backend. The default is the free-tier-capable
`gemini-3.5-flash-lite`; `GEMINI_MODEL` can override it server-side. Manual entry
works without configuration. Free-tier usage is quota-limited and Google may
use submitted names to improve its products; billing-enabled projects follow
Google's pricing. See the root README for setup and endpoint/error details.

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
Add Quote, Edit Quote, and Review Quote mark required fields with an asterisk
and provide field guidance on label hover instead of inline explanations.
They load `/api/categories` and offer optional multi-select
checkbox groups for Tone, Theme, Form, and Source. Options use server-provided
IDs and labels, not a hardcoded catalog. Every group shows its selection count
in its summary, including when collapsed, and has a Clear action when expanded.
Groups start collapsed and can be toggled independently. All groups may be empty.

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
