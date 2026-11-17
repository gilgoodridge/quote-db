# Quote DB

A structured, normalized database service for storing and analyzing quotations from famous authors and speakers, with a modern React SPA frontend.

## Purpose

Unlike wiki-based quote collections, Quote DB provides a **relational database** designed for:
- **Structured data**: Quotations linked to authors, sources, topics, and metadata
- **Normalized schema**: Eliminates duplication, ensures data integrity
- **Analytics**: Query and analyze quotes across dimensions (author, year, topic, etc.)
- **Scalability**: REST API for programmatic access
- **Web UI**: Modern SPA frontend for browsing and managing data

## Quick Start

### Prerequisites
- Java 25+
- MySQL 8.0+
- Maven 3.9+
- Node.js 24 LTS+
- npm 11+

### Setup

#### Backend
1. Clone the repository
2. MySQL will auto-create `quote_db` database on first run; Flyway creates the tables and indexes.
   For an existing database, follow [Database Migrations](#database-migrations) before starting.
3. Build: `mvn clean package`
4. Run: `java -jar target/quote-db-1.0-SNAPSHOT.jar`
   - Starts on `http://localhost:8080`
   - API Docs: http://localhost:8080/swagger-ui.html

#### Frontend
1. Navigate to `frontend/` directory
2. Install: `npm install`
3. Dev server: `npm run dev`
   - Starts on `http://localhost:5173`
   - Hot reload enabled: changes save automatically
4. Production build: `npm run build`
   - Outputs to `frontend/dist/` (static files)

## API Overview

For guidance on choosing names and entering author and quote information, see
[Editorial Guidelines](EDITORIAL-GUIDELINES.md). That guide distinguishes
established name rules from editorial policies still to be defined.

### Available Endpoints

#### Candidate staging

`candidate_authors` and `candidate_quotes` are separate review records, not
published authors/quotes. Flyway **V9** creates the tables without changing
existing content. Signed-in users can review candidates near the top of the
right-hand panel; signed-out visitors see Coming Soon in the same area.
Enrichment, automatic author matching, and Python importer integration are not
implemented.

**Review workflow:** Review next candidate requests
`GET /api/candidate-quotes?status=PENDING&page=0&size=1` (oldest ID first).
**Snooze** changes a pending quote candidate to `SNOOZED` without saving draft
edits or publishing it; it is excluded from the pending queue. **Review snoozed**
requests `GET /api/candidate-quotes?status=SNOOZED&page=0&size=1` (oldest ID
first). Approval or rejection advances to the next item in the queue being
reviewed; snoozed candidates remain snoozed if the reviewer closes the form.
An approved candidate author with a publication link is selected automatically.
Otherwise, the candidate name is searched before Review author opens. An exact,
case-insensitive full-name or known-as match prompts the reviewer to view the
author details, use the existing author, or create a new one; searching can be
retried if it fails. Using an existing author links and approves the candidate
author without creating a duplicate. With no match, Review author uses the
existing author form (including its required date of birth). **Snooze quotes**
marks every quote candidate linked to this author `SNOOZED` and leaves the
author pending; **Reject author and quotes** marks the author and all its quote
candidates `REJECTED`. Both actions preserve quote text and any published quote
links, do not delete data, and continue with the pending quote queue. Saving a
new author or linking an existing one promotes the candidate atomically.
Closing the author prompt/form opens Review Quote with no author selected. Review Quote
prefills the candidate text and source URL as Primary reference; the external-link icon
opens HTTP/HTTPS references in a new tab. Both references retain the published quote's
255-character limit; longer imported URLs must be edited before publication.
Approve creates a normal quote with the selected author, optional character and
categories, then marks the candidate APPROVED with its edited text and
`publishedQuoteId` in the same transaction. Reject marks only the candidate REJECTED, preserving its
stored text and publication link; it does not publish or save draft edits.
The top-right close button cancels review without changing the quote candidate.
Review actions are duplicated in the fixed title bar so they remain visible
while scrolling, with the same validation and saving/retry state as the bottom
buttons. Create/Edit Quote retain bottom actions only.
Successful approval or rejection automatically opens the next pending candidate;
an empty queue or loading failure returns to the panel with a visible message.
Created authors remain published even if the quote is cancelled or rejected.
Promotion endpoints lock their candidate records and atomically create/link the
published record and mark the candidate APPROVED. Retrying after a lost or
ambiguous response returns the existing linked record without creating a
duplicate; concurrent promotion requests are serialized. Quote promotion also
locks the candidate author, so rejecting that author prevents a concurrent or
later quote promotion. GET does not claim or reserve a queue item, so reviewers
may still open the same item concurrently. Row locks serialize mutations, but
review forms do not use revision/version checks: a reviewer can submit a stale
decision after another reviewer has acted. In that case the later mutation may
overwrite the candidate's status or publication link; for example, a pending
quote can be rejected and then promoted by a stale approval if its candidate
author has not been rejected. Duplicate promotions of an already-linked
candidate reuse the same published record, but this is not general conflict
detection or a reservation system.

**Temporary access policy:** Candidate reads, imports, and review-field updates
permit anonymous access. Promotion endpoints require authentication because
they create published content; all mutations require CSRF. These endpoints are
not an admin boundary: anyone with access to the backend can read/import/edit
staging data. Existing published-content write endpoints still require login
and CSRF.

| Method | Endpoint | Behavior |
|--------|----------|----------|
| GET/HEAD | `/api/candidate-authors` | List; optional `status` |
| GET/HEAD | `/api/candidate-quotes` | List; optional `status` and `candidateAuthorId`, combined with AND |
| GET/HEAD | `/api/candidate-authors/{id}`, `/api/candidate-quotes/{id}` | Read one candidate; missing ID returns 404 |
| POST | `/api/candidate-authors` | Import one author candidate |
| POST | `/api/candidate-quotes` | Import one quote attached to an existing candidate author |
| POST | `/api/candidates/batch` | Atomically import up to 100 authors and 100 quotes |
| POST | `/api/candidate-authors/{id}/promote` | Create and link an author and approve its candidate atomically (authenticated) |
| POST | `/api/candidate-authors/{id}/link` | Link an existing author and approve its candidate atomically (authenticated) |
| POST | `/api/candidate-quotes/{id}/promote` | Create and link a quote and approve its candidate atomically (authenticated) |
| POST | `/api/candidate-authors/{id}/snooze-quotes` | Set all linked quote candidates to `SNOOZED`; keep the author unchanged |
| POST | `/api/candidate-authors/{id}/reject` | Set the author and all linked quote candidates to `REJECTED` |
| PUT | `/api/candidate-authors/{id}` | Replace `fullName`, `status`, optional `publishedAuthorId` |
| PUT | `/api/candidate-quotes/{id}` | Replace `text`, `status`, optional `publishedQuoteId` |

Lists use ID ascending, zero-based `page` (default 0) and `size` (default 20,
1-100), returning `content` and `page` metadata. Invalid filters/pagination
return 400. Candidate authors support `PENDING`, `APPROVED`, and `REJECTED`;
candidate quotes additionally support `SNOOZED`.
There are no candidate DELETE endpoints: reject unwanted candidates so import
retries do not bring them back.
New quotes cannot be imported for a rejected candidate author.

Author import example:

```json
{
  "importKey": "enwikiquote:2",
  "source": "enwikiquote",
  "sourcePageId": 2,
  "sourceRevisionId": 4021123,
  "dumpDate": "2026-10-01",
  "sourceTitle": "Albert Einstein",
  "sourceUrl": "https://en.wikiquote.org/wiki/Albert_Einstein",
  "fullName": "Albert Einstein"
}
```

Quote imports require the same provenance fields plus `candidateAuthorId`
(the ID returned by author import), `text`, and `rawWikitext`; `sourceNotes`
is optional. Use a distinct stable quote key, for example
`enwikiquote:2:quote:<sha256-of-original-quote>`, not a position in the filtered
output. Keys should not include the dump date or revision: reruns and larger
samples must retain identity. Keys are lowercase ASCII, 1-128 characters,
starting with a letter/digit and otherwise allowing letters/digits and `:._/-`.
Keys are unique separately within each candidate type.

POST returns 200 with a DTO. A new key creates a `PENDING` record. A repeated
key returns the existing record **without overwriting anything**, including
edits, review state, publication links, and the original provenance. Reusing a
key for a different source/page or quote parent returns 409. Concurrent inserts
are protected by database uniqueness; on a uniqueness 409, retry POST to
retrieve the winner. With the individual endpoints, a failed quote does not roll
back earlier imports or the candidate author.

**Batch import:** POST `/api/candidates/batch` accepts an object with required
`authors` and `quotes` arrays (each may be empty, but not both). Each array has a
maximum of 100 non-null entries. Authors use the author import fields above.
Quotes use the single-quote import fields, except `candidateAuthorImportKey`
replaces `candidateAuthorId`. This key identifies an author in the same batch
or an earlier import, so clients need no author-ID round trip. Authors are
processed before quotes, regardless of their array positions.

The 200 response is `{ "authors": [...], "quotes": [...] }`, containing the
normal stored candidate DTOs in each input array's order, including repeated
entries. Existing keys retain the same idempotency, provenance and review
preservation rules as single imports. All writes in a batch share one
transaction: invalid fields or unknown parent keys return 400; conflicting
source/page/parent identities or concurrent uniqueness conflicts return 409.
Any failure rolls back the entire batch, not earlier successful batches.
Retry the entire batch with the same keys after resolving the error; a retry
after a lost response is also safe. CSRF is required; anonymous access remains
enabled under the temporary staging policy.

`tools/wikiquote-review/extract_candidates.py` uses this endpoint, buffering
100 candidates per request by default (`--batch-size 1-100`), with a 512 KiB
encoded JSON limit to stay below common reverse-proxy body limits. It flushes
the final partial batch before replacing the report and fetches one CSRF token
per batch instead of per candidate. Deploy the batch endpoint before running
the updated importer. See `tools/wikiquote-review/README.md`.

PUT requires the editable name/text and status; omitted/null publication IDs
clear the link. Import keys, provenance, original wikitext, source notes, and
the candidate quote's parent are immutable. Unknown/nonpositive referenced
IDs return 400 without applying the edit. Publication links reference existing
records only; `APPROVED` does **not** create published content or require a link.
There are deliberately no promotion rules yet. Linked published records cannot
be deleted until their candidate links are cleared (409), unless quote deletion
explicitly requests the transactional recovery below.

`DELETE /api/quotes/{id}` returns an RFC 9457 `application/problem+json` response
when candidate quotes reference it: `type` is
`urn:quote-db:problem:quote-linked-to-candidates`, `code` is
`QUOTE_LINKED_TO_CANDIDATES`, and `detail` is
`Quote is linked to candidate review data`. Clients identify this conflict by
HTTP 409 and the stable code, not human-readable text or HTTP status alone.
Other errors retain their existing formats.

After explicit confirmation, `DELETE /api/quotes/{id}?candidateStatus=REJECTED`
or `candidateStatus=PENDING` updates **all** candidates linked to that quote to
the chosen status, clears their `publishedQuoteId`, and deletes the published
quote in one transaction. Any deletion failure rolls back the candidate changes
too. Other status values are invalid (400). A completed deletion can be retried
without changing candidate statuses again. Candidate text, import identity,
provenance and candidate-author links are preserved; authors and characters
are never deleted. This recovery requires the same authentication and CSRF as
normal quote deletion; it does not change candidate endpoint permissions.

Names/titles allow 255 characters, source 64, URLs 2,048 (HTTP/HTTPS),
cleaned text 2,048, and raw wikitext/source notes 16,000 each.
Page/revision IDs must be positive; dump dates are required date-only values.
The backend does not apply the Python extractor's language/sentence/500-character
heuristics. DTOs expose related IDs, never ORM entities or collections.

#### Authors
- `GET /api/authors?page=0&size=20&query={text}` - List a page of authors, optionally searched by full name
- `POST /api/authors` - Create author
  ```json
  {
    "fullName": "Samuel Langhorne Clemens",
    "knownAs": "Mark Twain",
    "dateOfBirth": "1835-11-30"
  }
  ```
- `PUT /api/authors/{id}` - **Full replacement** (all optional fields omitted are cleared)
  ```json
  {
    "fullName": "Jane Austen",
    "knownAs": "Jane Austen",
    "dateOfBirth": "1775-12-16",
    "nationality": "US"
  }
  ```
- `DELETE /api/authors/{id}` - Delete author

**AI editorial lookups:** `POST /api/ai/lookups` is the single lookup endpoint for
editor/reviewer suggestions. It requires login and CSRF, never saves content,
and does not cache responses. Select a server-defined `type` and supply structured
`context`; clients cannot supply prompts. Supports `AUTHOR_DATE_OF_BIRTH`,
`AUTHOR_DATE_OF_DEATH`, `AUTHOR_PLACE_OF_BIRTH` and `AUTHOR_BIOGRAPHY`, all with
required nonblank `context.fullName` (255 characters max):

```json
{
  "type": "AUTHOR_DATE_OF_BIRTH",
  "context": {"fullName": "Jane Austen"}
}
```

Returns `{"status":"FOUND","value":"1775-12-16"}` or `{"status":"UNKNOWN"}`.
Dates use ISO `YYYY-MM-DD` in the generic string `value`. Missing/unsupported
types and invalid context return **400** before contacting Gemini.
`AiLookupController` handles the API, `AiLookupService` owns server-defined
prompts and type-specific validation/normalization, and `GeminiClient` owns
provider transport/error handling. Add future author/quote lookup types through
this same contract rather than new controllers/routes. For death dates, send
`AUTHOR_DATE_OF_DEATH`; a found date uses the same ISO string `value`.

For birthplace, send `AUTHOR_PLACE_OF_BIRTH`. The prompt requests **99% confidence**,
preferring city/town, administrative divisions and country, in that order. If
some components are uncertain, it requests only the confidently known components,
which may include a city alone. It asks for nothing more specific than a city or
town, and returns UNKNOWN for an ambiguous identity or entirely unknown birthplace.
The response `value` is the location text (255 characters max).

For biography, send `AUTHOR_BIOGRAPHY`. The prompt requests a factual,
professional, neutral account of work, career and achievements, excluding
controversies, speculation, the person's name/aliases, birth/death dates or
years, and birthplace. It requests at most three sentences in one paragraph
(1024 characters max). Biography asks for the best summary using reliable known
facts, without an IDK option or confidence threshold. All lookup prompts describe
a person, not an author, so they do not assume a writing profession.
The response `value` is the biography text. The backend rejects
overlength/multiline text and biographies exceeding three sentences rather than
silently truncating them. Factual accuracy, geographic completeness and semantic
exclusions are prompt instructions, not independently verified facts: review
suggestions before saving.

**Optional Gemini author lookups:** Set `GEMINI_API_KEY` in the backend process
environment (local run configuration or production service environment), then
restart the backend. Create a key in [Google AI Studio](https://aistudio.google.com/api-keys).
Never commit the key or put it in `VITE_*` variables. Without a key, the app still
starts and manual author entry works; lookup returns a visible **503** configuration error.
`GEMINI_MODEL` optionally overrides the default `gemini-3.5-flash-lite`, a
low-cost stable model with [free-tier input/output](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite).
Use a free-tier project to stay within free allowances; billing-enabled projects
follow Google's pricing. There is no automatic paid-model fallback, grounding,
or retry. Each click sends the entered full name to Google; free-tier requests
may be used by Google to improve its products.

The backend asks for an exact `MM/DD/YYYY` birth/death date at 99.9% confidence, or
`IDK` for uncertainty, ambiguous identities, or incomplete/disputed dates.
Death-date lookup also returns UNKNOWN for living authors or unconfirmed deaths;
it must never predict a death or substitute a burial date.
Only a strictly valid, nonfuture date is returned as ISO `YYYY-MM-DD`; malformed,
blocked or truncated output is an error, not uncertainty. **This prompt does not
provide a calibrated 99.9% accuracy guarantee: verify suggestions before saving.**
Quota/rate-limit failures return **429**; provider/key/model/response errors return
**502**, and network/timeout failures **504**, with safe visible messages.
Connections time out after 10 seconds and responses after 30 seconds; provider
response bodies and API keys are never forwarded to the browser.

The optional `query` searches **fullName or knownAs** using case-insensitive substring
matching; for example, `/api/authors?query=shake` finds William Shakespeare,
and `/api/authors?query=twain` finds Samuel Langhorne Clemens by his alias Mark Twain.
Leading/trailing whitespace is trimmed; an omitted or blank query lists all
authors. The query is literal text (`%`, `_`, and `\` are not wildcards).
Unlike quote FULLTEXT search, author search has no stemming, relevance ordering,
or whole-word/minimum-word-length restriction. Results remain ID ascending,
with pagination and totals computed in the database after filtering.

The Authors section has a compact search field above its list. Press **Enter**
or click the search icon to submit immediately; otherwise search runs after a
**500 ms pause in typing**. Further typing restarts the delay,
and clearing the field immediately restores the first unfiltered page. The list
requests and shows **10 authors initially**; **More authors** at its bottom
appends the next 10, disappearing when all matches have been loaded. Loading,
no-match, and retryable error states are visible; outdated responses are ignored.
Author creation/updates refresh the first page with its current query intact.
New searches and clearing reset to page 0. Loading more preserves the existing
authors; failures are retryable on the same page without losing loaded results.
Searching the author list does not change the selected author or quote
text/category filters, even when the selected author is hidden by the search.
Clicking a selected author or character again clears only that selection.
Display labels continue to prefer `knownAs`; matching uses either `fullName` or
the displayed alias.

Creating or replacing an author requires both `fullName` and `dateOfBirth`
(`YYYY-MM-DD`); missing either returns **400 Bad Request**. Authors with the same
birth date cannot share a full name or a nonblank known-as name. Matching is
within each field (not across fields) and follows the database collation.
Blank known-as names are stored as null and do not count as duplicates.
Database unique constraints enforce this for creates and updates, including
concurrent requests. A duplicate returns **409 Conflict** with the message
**"The author already exists"**, which the author form displays prominently
without clearing the entered values.

**Existing databases:** Before deploying, back up the database and resolve any
missing birth dates and duplicate `(full_name, date_of_birth)` or nonblank
`(known_as, date_of_birth)` pairs. Normalize existing blank known-as values to
null. Do not invent dates or automatically delete/merge authors, which may have
quotes attached. Before baselining an existing database, verify the required
birth date and the `uk_author_full_name_birth` / `uk_author_known_as_birth`
unique constraints are already present. See [Database Migrations](#database-migrations).

#### Characters

Characters are fictional speakers in books, movies or plays. They **do not
replace authors**: a quote always has an author (the writer), and may optionally
have a character. Narration can leave the character unassigned.

- `GET /api/characters?page=0&size=20&query={text}` - List characters
- `GET /api/characters/{id}` - Get a character
- `POST /api/characters` - Create a character
- `PUT /api/characters/{id}` - Full replacement; omitted/null optional fields are cleared
- `DELETE /api/characters/{id}` - Delete an unlinked character

Example create or replacement body:

```json
{
  "fullName": "Hamlet",
  "knownAs": "Prince Hamlet",
  "description": "Prince of Denmark",
  "workTitle": "Hamlet"
}
```

`id` is generated and response-only. `fullName` is required and nonblank (maximum
255 characters). `knownAs` and `workTitle` are optional (255 characters each);
`description` is optional (1024 characters). Blank `knownAs` is stored as null.
Names are not unique: different works may have characters with the same name.
The optional `query` follows author search: trimmed, case-insensitive literal
substring matching on **fullName only**, with ID-ascending database pagination.
GET/HEAD is public; writes require authentication and CSRF. Invalid fields
return **400**; missing characters return **404**. Deleting a character linked
to quotes returns **409 Conflict**; unlink it from those quotes first.

Quote POST/PUT accepts optional `characterId`. Unknown, zero or negative IDs
return **400** without saving any changes. `authorId` is still required.
Omitted/null `characterId` leaves a new quote unassigned and **clears it on PUT**.
Quote responses include `character` as `{id, fullName, knownAs, description,
workTitle}` when assigned; null fields are omitted under the existing JSON
policy. Deleting a quote never deletes its character or author. Character
assignment does not depend on category selections.

The left filter panel includes independent author and character searches, each
loading 10 names at a time with **More** paging and a 500 ms search delay.
Character selection combines with author, category and quote-text filters using
AND. Searching either list does not clear a selection or change other filters.
Character labels prefer known-as names and include the work title, when available,
to distinguish identically named speakers.

Character names on quotes and **Info** buttons in the filter panel open public
character details. Quotes with characters use one
attribution line: character in *work title* by author, with clickable character
and author names. If no work title is available, the "in work title" phrase is
omitted. Quotes without characters show the author beneath the quote. Attribution
is the same whether or not an author or character is selected in the filters;
neither selection adds a heading above the results.
Signed-in users can create characters from the panel or quote
form and edit them from their details. Optional cleared fields are sent as null;
failed saves keep the draft. Changes refresh the character list and quote results
without clearing filters. Character deletion is not exposed in the frontend.

Quote forms include an optional character picker, prefilled from the selected
filter or existing quote. Saving always sends `characterId`, preserving the
assignment unless **No character / narration** is selected. Loading errors are
visible and retryable; saving is blocked until the character options load.
API clients must also include `characterId` on PUT to retain the association.

#### Quotes
- `GET /api/quotes?page=0&size=20&authorId={id}&characterId={id}&query={text}&toneIds={id}&themeIds={id}&formIds={id}&sourceIds={id}` - List a page of quotes, optionally filtered by author/character/categories and searched by text
- `POST /api/quotes` - Create a quote with `text`, `authorId`, and optional
  `characterId`, `date` (`YYYY-MM-DD`), `location`, `primaryReference`, `secondaryReference` (an optional second source; V10 renamed the former `reference` column to `primary_reference`, preserving data), `toneIds`, `themeIds`, `formIds`, and `sourceIds`
- `GET /api/quotes/{id}` - Get a quote
- `PUT /api/quotes/{id}` - Replace a quote
- `DELETE /api/quotes/{id}` - Delete a quote

#### List pagination

Author, character and quote list endpoints use Spring Data's page-number convention:
`page` is **zero-based** (default `0`), and `size` defaults to `20` (allowed
range `1`-`100`). For example, `/api/authors?page=1&size=20` returns the second
page. Negative pages, out-of-range sizes, non-integer values, and page/size
combinations exceeding the JPA offset limit (`2,147,483,647`) return **400**.

These endpoints return Spring Data's stable `PagedModel` JSON envelope, not
a bare array (a breaking change for external clients):

```json
{
  "content": [{"id": 1, "fullName": "Example Author"}],
  "page": {
    "size": 20,
    "number": 0,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

`content` contains the existing response DTOs. Totals reflect **all active
filters**, not the whole table. An empty result or a page beyond the last page
returns **200** with `content: []` and the actual totals. An empty result has
`totalPages: 0`. Fetch subsequent pages until `page.number + 1 >= page.totalPages`,
keeping the same filters and size.

Authors, characters and non-search quotes are ordered by ID ascending; quote searches
remain ordered by relevance descending, then ID ascending. Custom sorting is
not supported. Pagination uses database-level offset/limit and count queries;
concurrent writes can shift page boundaries, so pages are not a snapshot.
Single-resource endpoints and `/api/categories` are unchanged.

The frontend's `api.authors.list(query = '')` collects successive pages with the
same query; calls without a query preserve complete author pickers.
Quote browsing requests only the current page and
provides Previous/Next controls at the bottom of the middle panel. Page labels
are one-based; API page numbers remain zero-based. Quotes per page offers
10, 20 (default), 50, and 100. Changing the size or author/search/category
filters resets to API page 0 while retaining the selected size.
Failed page loads are visible and retryable; deleting the last quote on a
page returns to the last remaining page.
`api.authors.listPage({query, page, size})` and
`api.quotes.listPage(authorId, query, categoryIds, {page, size})` return a single
page with metadata. `api.quotes.list(...)` remains an all-pages helper, but is
not used for quote browsing. The Authors sidebar uses `authors.listPage` with
size 10 and a **More authors** action instead of collecting every page upfront.
Complete author pickers elsewhere continue to use `authors.list()`.

#### Quote categories

`GET /api/categories` is public and returns four read-only catalogs:
`tones`, `themes`, `forms`, and `sources`. Each is an array of
`{"id": 1, "name": "...", "description": "..."}` objects, ordered by ID.
IDs are local to each dimension. Descriptions explain the scope of each option.
Use the catalog rather than assuming particular ID values.
There are no category-management endpoints. Change the defined options through
a new Flyway migration.

| Dimension | Meaning | Defined options |
|-----------|---------|-----------------|
| Tone | What it does to the reader | Inspirational, Funny, Insightful, Comforting, Cautionary, Cynical, Provocative |
| Theme | What it is about | Life & death, Love & connection, Success & failure, Work & ambition, Wisdom & learning, Courage & resolve, Joy & meaning, Time & change, Society & power, Art & beauty, Faith & belief, Human nature |
| Form | How it is built | Aphorism, Paradox, Metaphor, Retort, Advice, Verse |
| Source | Where it came from | Movie, Speech, Play, Letter, Book, Article, Poem, Song, Interview, Conversation, Journal |

Every dimension allows **zero or multiple selections**. Source is a type, not
the precise `location` (page, scene, venue, etc.) or the reference URLs.
`Excerpt` is not a form. `Poem` is a source; `Verse` is a form.
All labels are at most 32 characters.

POST and PUT accept optional arrays of positive category IDs:

```json
{
  "text": "An example quotation",
  "authorId": 1,
  "toneIds": [1, 3],
  "themeIds": [5],
  "formIds": [],
  "sourceIds": [4]
}
```

Look up the IDs first; the numbers above are illustrative. Duplicate IDs are
deduplicated. Unknown IDs, null elements, zero, and negative IDs return
**400 Bad Request** with a message identifying the affected field. Invalid
selections reject the entire write, without partially updating the quote.
Quote responses on POST, PUT, get-by-ID, lists, and search contain `tones`,
`themes`, `forms`, and `sources` as arrays of `{id, name, description}` DTOs, sorted by ID.
Unassigned dimensions return `[]`.

Omitted, null, and empty arrays mean no selections on POST. On **PUT**, they
**clear that dimension**, consistent with full replacement of other optional
fields. Include all selections you want to retain. Quote writes still require
authentication and CSRF.

The **Add Quote / Edit Quote / Review Quote** dialog uses asterisks for required
fields and label hovertext for field guidance. It loads these catalogs and provides checkbox
groups for all four dimensions, with selection counts and a **Clear** action
per group. Groups start collapsed, retain visible selection counts in their
summaries, and expand independently. No selection is required. Editing prefills existing selections;
saving includes all four ID arrays, so changing text or other metadata does not
clear categories unintentionally. Unchecking options or clearing a group removes
those selections on save.

The left navigation filters quotes by author and optional category checkboxes.
Select multiple options within a category dimension to match any of those
options; filters across dimensions are combined with one another, the selected
author, and text search using **AND**. The name lists have compact scroll areas
targeting about five authors and three characters; the character area is 3/5
of the author area's height. Short screens and wrapped names may show fewer.
Category filters remain accessible alongside them. Click a selected name again
to clear only that author or character filter.

Category loading failures are visible and retryable without discarding the
draft. Save stays disabled until the catalogs load, to avoid saving with
incomplete category controls. Write failures likewise keep entered values and
selections intact. Selected category labels appear under their dimension in
expanded quote details, including public search results. Empty dimensions are
not displayed. Category controls and tags wrap on narrow screens and use the
existing light/dark theme colors. Category filters can be combined with text search; text search itself continues
to search quote text only.

Hover over a category checkbox label or a selected category tag to read its
scope description. Checkbox descriptions are also associated with the input
for screen readers; tag descriptions are included as screen-reader text.
Descriptions come from the backend, not a second frontend catalog. Older backend
responses without descriptions still allow selecting and saving categories.

Flyway V6 creates separate `tones`, `themes`, `forms`, and `sources` lookup
tables with auto-increment IDs and unique names, plus `quote_tones`,
`quote_themes`, `quote_forms`, and `quote_sources` junction tables. Composite
primary keys prevent duplicate selections; foreign keys enforce valid IDs.
Deleting a quote removes its junction rows, not its author or catalog entries.
Existing quotes retain their data and start with no categories.
V7 adds a required `description` column (up to 255 characters) to each catalog
and fills all 36 descriptions without changing category IDs or quote selections.
V6 is already deployed and is unchanged; deploy the new backend to apply V7
and provide descriptions to the frontend. Quote requests still accept only
category IDs, not names or descriptions.

#### Searching quotes

`GET /api/quotes?query=love%20life` searches **quote text only** with MySQL's
built-in InnoDB FULLTEXT index and `IN NATURAL LANGUAGE MODE`. No database
add-ons, embeddings, or external search service are required. Java normalizes
both quote text and queries with **Snowball English (Porter2)**, via Apache
Lucene's `SnowballFilter` and `EnglishStemmer`, before
MySQL searches the derived `quotes.search_text` column. Combine with `authorId` to search within an author:
`/api/quotes?authorId=1&query=love`. Category IDs can also filter the listing
or search results, for example
`/api/quotes?query=love&authorId=1&toneIds=2&toneIds=3&themeIds=5`.
Use repeated parameters to select multiple IDs in one dimension. A quote
matches any selected ID within a dimension, while selected dimensions, author,
and text search are combined with **AND**. Omit a category parameter to leave
that dimension unrestricted. The response remains a list of `QuoteResponse`
DTOs; no score is exposed. Search remains available to anonymous users.

- Any searchable word can match; results are sorted by relevance descending,
  then quote ID ascending for ties. Relevance uses the whole quote corpus,
  even when filtering by author.
- Double quotes enable MySQL natural-language **phrase matching**. Words inside
  and outside quotes are stemmed, but quote boundaries are preserved. For example,
  `"hoping for peace"` matches `hoped, for peace`, but not `peace for those who hoped`.
  Phrase matching requires the normalized words in order; punctuation need not
  match, and this is not an exact original-text substring match.
- `"to be or not to be"` retains phrase matching, unlike the unquoted query
  which can match quotes sharing `not`. MySQL's default InnoDB stopwords do not
  include `not`; a phrase with no indexed terms (such as `"to be"`) returns no matches.
- There is no connector/Boolean syntax parsing or query expansion. `AND`, `OR`,
  and `+` are not operators. Empty and unmatched double-quote boundaries are
  retained and left to MySQL's native interpretation.
- English stemming matches plurals and other word forms: `move`, `moves`,
  `moved`, and `moving` normalize to `move`; `walked`/`walking` to `walk`;
  `connected`/`connections` to `connect`. Stems need not be dictionary words:
  `study`/`studies`/`studied` normalize to `studi`. This is more aggressive
  than Krovetz and can conflate distinct words. It is not synonym, substring,
  or vector/semantic search, nor universal lemmatization: `children` and `child`
  remain distinct. Only the English Snowball algorithm is used.
- Standard tokenization and lowercasing precede stemming. Accents are retained
  by the Java normalizer; MySQL case/accent matching follows the `search_text`
  column collation. Original quote text and returned DTOs are unchanged;
  `search_text` is internal and never exposed in the API.
- MySQL's default InnoDB parser ignores stopwords and normalized tokens shorter than three
  or longer than 84 characters. A nonblank query with no indexed/matching terms
  returns `[]`; it does not fall back to listing everything.
- Omitted, empty, or whitespace-only `query` preserves the original listing
  behavior (including author, character and category filters, with ID-ascending order).
- JPA `@PrePersist` / `@PreUpdate` callbacks regenerate `search_text` on quote
  saves; MySQL maintains its index on creates, updates, and deletes. Query
  words use that same helper through `QuoteSearchText.normalizeQuery`, which
  additionally retains double-quoted phrase boundaries.
  Use the API/JPA for quote writes, including seed imports. Direct SQL and
  bulk JPQL writes bypass callbacks: those paths must populate/regenerate
  `search_text` with that same helper, not merely copy the original text.
- Changing the analyzer, stemmer, or Lucene version requires a new migration
  to backfill all derived text consistently with query normalization. Changing
  MySQL token-size or stopword settings requires rebuilding the index.

The Maven dependency `org.apache.lucene:lucene-analysis-common` is distributed
under Apache-2.0 and includes Snowball code with BSD licensing notices.
No standalone stemming dependency or Lucene index/server is used. The executable JAR includes
the Lucene dependency JARs with their applicable `META-INF/LICENSE*` and
`META-INF/NOTICE*` files; retain these notices when redistributing dependencies.

See [MySQL natural-language full-text search](https://docs.oracle.com/cd/E17952_01/mysql-8.0-en/fulltext-natural-language.html)
for matching and relevance details.

In the header, type a query and press **Enter** (or click the search icon).
Selected author, character and category filters also constrain the search;
without filters all quotes are searched. Mixed-author results display each
quote's author. Changing or clearing a filter reruns the submitted search in the new scope.
Editing nonblank text does not search until submission; clearing the box
immediately returns to browsing with the remaining filters (or the selection prompt).
Submitting again also retries a failed search. Loading, failures, and no matches
are displayed separately, and results retain the backend's relevance ordering.

Every quote displays its author beneath the quote, using the known-as name
or full name from the quote response. Selecting an author filters results without
adding an author heading or changing attribution.

Click an author name beneath a quote or an author’s **Info** button in the
sidebar to open the **About this Author** dialog. It shows the full name,
known-as name, birth and death dates, birthplace, nationality, biography, and age when available.
Missing optional details are marked **Not provided**. Details load independently
with a retry action on failure.

Dialogs use the shared `DialogHeader` with a neutral **×** close
button in the top-right corner, separate from the scrolling content. Its
accessible label and hover tooltip identify it as a close action, not the red
quote-delete action; closing author details never deletes the author. Use this
header for future dialogs too. The icon has no surrounding border or background;
keyboard focus retains a visible outline for accessibility.
Form close buttons are disabled while saving.

**Form dialog conventions:** Quote, author and character forms mark mandatory
fields with ` *` instead of required/optional parentheticals, preserving native
validation. Concise label hovertext replaces introductory guidance. Author and
character field descriptions are shared with their field definitions. Use
`DialogHeader` outside the scrolling body, with 16px of top body padding, theme-aware
colors and narrow-screen wrapping. Create/edit actions remain at the bottom;
only Review Quote duplicates actions in the fixed title bar, sharing validation,
saving guards and retry state. Quote category groups start collapsed and expand
independently, keeping selection counts visible and selections intact.
Preserve retryable errors, failed drafts, focus restoration and full-replacement
save semantics when simplifying dialog presentation.

Signed-in users also see an unboxed **Edit** action with a small pencil beside
the title, separate from the close button. It opens
the author form prefilled for editing; saving sends a full replacement, so
clearing optional fields removes them. Failed saves preserve the draft.
Create/edit/review author forms use asterisks for required full name and birth
date, with label hovertext for field guidance instead of an introductory paragraph.
**Look up with AI** beside Date of birth, Date of death, Place of birth and
Biography uses the current full name in all three forms. Each suggestion populates
only its own editable draft field, never saves it, and leaves other fields unchanged.
Date of death, birthplace and biography remain optional.
Uncertainty and errors leave any existing value unchanged and are shown in the
dialog. Form edits, saves and review mutations are disabled while looking up;
closing/cancelling remains available and late responses are ignored. Lookup is
also disabled for locked promotion retries or already-published review authors.
Known as remains the display name when provided. Saving a new author publishes
it immediately, even if the surrounding quote form is later cancelled.
Character create/edit forms follow the same presentation, requiring only full
name; hovertext explains the fictional-speaker role and other fields. New
characters also remain saved when a surrounding quote is cancelled.
Cancel returns to the unchanged details. A successful save updates the dialog,
quote attribution, quote results, and Authors sidebar without changing filters.
Anonymous users can view all details but cannot edit.

### Adding a quote in the UI

**Add Quote** is always visible in the right side of the header. **Quote of the
Day** sits beside the Quotes DB logo on the left. Anonymous users are prompted
to sign in with Google before adding a quote; after sign-in, the form opens
automatically. A tab-scoped session-storage flag preserves only this intent
across the redirect, not credentials or quote data. Browser session storage must
be available to resume the action automatically.

The form includes all POST fields: quote text (up to 2,048 characters), an
existing author and optional character selected from dropdowns, date, location, and primary and secondary references (the
latter three up to 255 characters each), and optional multi-select Tone, Theme,
Form, and Source groups. The currently selected author and character are
preselected. **Add new author** opens a separate form without losing your quote
draft. It supports all author POST fields: required full name and birth date,
optional known-as name, death date, birthplace, nationality, and biography. The known-as name is
used for display when present; otherwise the full name is displayed. Text fields
allow up to 255 characters (biography: 1,024).
Saving immediately creates the author, selects them in the quote dropdown, and
refreshes the Authors sidebar. Cancelling the quote does not delete an already
saved author. Cancelling the author form returns to the unchanged quote draft.
After a successful save, the author's quotes are refreshed and displayed.
Saving failures leave the form and entered values intact.

### Editing and deleting quotes in the UI

Signed-in users see pencil (edit) and X (delete) buttons at the top-right of
each quote card. Editing opens the same form prefilled with all quote fields,
including the author, character and category selections. Saving sends a full replacement: clearing an optional
field removes its value. Results refresh in the current author/search scope,
so a changed quote may no longer match. Cancel leaves the quote unchanged;
save failures keep the draft open.

Delete requires browser confirmation before sending the request. Failures are
shown without removing the card. Only the `QUOTE_LINKED_TO_CANDIDATES` conflict
opens a recovery dialog: reject the linked candidate quotes or return them to
Pending, clear their publication links, and delete the quote atomically.
Cancel makes no changes. While saving, duplicate submissions and dismissal
are blocked; failed saves remain visible and retryable. Successful recovery
refreshes quote results and pending candidate counts. Deleting a quote never deletes its author,
even when it was their last quote. Both actions use the existing
session-authenticated, CSRF-protected PUT and DELETE endpoints.

From `frontend`, run `npm test` for API contract tests and category form/card
interaction tests (Vitest, Testing Library, and jsdom), `npm run lint` for
Oxlint, and `npm run build` for the production bundle.


## Architecture

### Tech Stack

**Backend**
- **Spring Boot 3.5.0** - REST service framework
- **Spring Data JPA** - ORM and database access
- **Hibernate 6.6** - JPA implementation
- **MySQL 8.0** - Relational database
- **MapStruct 1.6** - DTO-to-entity mapping
- **SpringDoc OpenAPI** - Swagger UI documentation

**Frontend**
- **React 18** - UI framework
- **Vite 8** - Fast build tool & dev server
- **Fetch API** - HTTP client for backend calls
- **CSS** - Styling (no CSS-in-JS framework required)

### Project Structure
```
quote-db/
├── src/main/java/org/gilgood/      # Backend
│   ├── Application.java             # Entry point
│   ├── config/
│   │   └── CorsConfig.java          # CORS setup for frontend
│   ├── controller/                  # REST endpoints
│   ├── entity/                      # JPA entities (Author, Quote, Source, etc.)
│   ├── repository/                  # Spring Data JPA repositories
│   ├── mapper/                      # MapStruct mappers (DTO ↔ Entity)
│   └── dto/                         # Request/Response DTOs
├── frontend/                        # React SPA
│   ├── src/
│   │   ├── App.jsx                  # Root component
│   │   ├── App.css                  # Global styles
│   │   ├── api.js                   # Backend API client
│   │   ├── AuthorList.jsx           # Authors table component
│   │   ├── AuthorList.css           # Component styling
│   │   └── main.jsx                 # React entry point
│   ├── dist/                        # Production build (generated)
│   ├── package.json
│   └── vite.config.js
├── pom.xml                          # Maven configuration
└── README.md
```

### Entity Design Pattern
1. **Entities** in `entity/` - represent database tables
2. **DTOs** in `dto/` - represent API input/output (excludes IDs for POST)
3. **Mappers** in `mapper/` - auto-map DTOs to entities (MapStruct)
4. **Repositories** in `repository/` - data access layer

This separation ensures clean ORM boundaries and prevents Hibernate conflicts.

### Frontend API Client Pattern
```javascript
// src/api.js - Centralized API calls
import { api } from './api'

api.authors.list()           // GET /api/authors
api.authors.get(id)          // GET /api/authors/:id
api.authors.create(dto)      // POST /api/authors
api.authors.update(id, dto)  // PUT /api/authors/:id
api.authors.delete(id)       // DELETE /api/authors/:id
```

Environment URL is configurable:
- **Dev**: `.env.local` → `VITE_API_URL=http://localhost:8080/api`
- **Prod**: `.env.production` → configure for deployed backend

### CORS Configuration
Backend allows requests from frontend dev server:
```java
// src/main/java/org/gilgood/config/CorsConfig.java
registry.addMapping("/api/**")
    .allowedOrigins("http://localhost:5173", "http://localhost:3000")
    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
```

## Development

### Running Backend & Frontend Together

**IntelliJ IDEA (one click)**

Run configurations are machine-local. The `.run` and `.idea` directories are
ignored by Git so local environment variables are not committed. Existing local
configurations remain available in the run configuration dropdown:
- **Full Stack** starts both the backend and the Vite frontend.
- **Frontend** runs `npm run dev` from the frontend directory.
- **Backend** runs `org.gilgood.Application`, matching the existing Application configuration.

Select **Full Stack** and click **Run**, then open http://localhost:5173.
Both processes have separate consoles in the Run tool window, where you can stop
them when finished. Stop any already-running copies first to avoid port conflicts.
MySQL must already be running, and frontend dependencies must be installed once
with `npm ci` in the frontend directory.

The frontend configuration requires IntelliJ's **JavaScript and TypeScript** and
**Node.js** plugins and uses the project Node.js interpreter. If prompted, set it
to Node.js 24 under **Settings > Languages & Frameworks > Node.js**.
The backend configuration uses the existing `ms-25` JDK; if your installed Java 25
SDK has a different name, select it under **Run > Edit Configurations > Backend > JRE**.
Your existing **Application** configuration is unchanged.

On a fresh clone, create these configurations under **Run > Edit Configurations**:
an **npm** configuration named **Frontend** targeting `frontend/package.json`
with command `run` and script `dev`; an **Application** configuration named
**Backend** targeting `org.gilgood.Application` in module `quote-db` with Java 25;
and a **Compound** configuration named **Full Stack** containing both.

**Using terminals instead**

**Terminal 1: Backend**
```bash
mvn spring-boot:run
# or in IDE: Run → Run Configuration → Application
# Runs on http://localhost:8080
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173 (with hot reload)
```

### Database Migrations

Flyway runs versioned MySQL SQL migrations from `src/main/resources/db/migration`
and Java migrations from `src/main/java/db/migration` before JPA starts.
`V1` creates the authors/quotes schema; `V2` adds the original `ft_quotes_text`.
`V3` adds the derived `search_text` column, `V4` backfills it with Snowball English
normalization in batches of 500 using keyset pagination, and `V5` makes it
NOT NULL and replaces the original index with `ft_quotes_search_text`.
`V6` adds and populates the four category catalogs and creates their quote
junction tables; existing quotes remain uncategorized.
`V7` adds and populates category scope descriptions, preserving IDs and selections.
`V8` creates characters and adds an optional, indexed character foreign key to
quotes. Existing quotes retain their authors and start without a character;
linked characters cannot be deleted until explicitly unlinked.
`V9` adds candidate author/quote staging, unique import keys, review states,
provenance, and optional links to published records.
Hibernate uses `spring.jpa.hibernate.ddl-auto=validate`,
not `update`. Add new migrations for future schema changes; do not edit migrations
that have already run. The database account needs schema DDL privileges in addition
to normal data access. Migration failures stop startup rather than allowing search
to run without its index.

**Upgrade an existing Flyway V2 database (including production):** Back up and
stop all old backend instances/writers before starting the new JAR. Flyway
applies V3-V9 automatically, preserving IDs, original text, authors, and all
metadata. No reset, reload, or new baseline is needed. The backfill and index
creation extend startup time and may lock the table; plan a maintenance window.
Do not run the old application alongside the upgrade: it cannot maintain the
new search column. Migration failures stop startup; because MySQL DDL is not
transactional, inspect any partial changes and Flyway history before repairing
and retrying a failed migration. Do not blindly drop tables or enable baselining.

**Fresh/reset database:** Stop the application and back up any needed data.
If resetting, drop the `quote_db` database (not just its rows), then restart.
Flyway automatically creates the schema and index; reload your seed data afterward.
No manual index creation is necessary. A reset deletes all authors and quotes.

**Existing database without Flyway history:** Back up first and verify it matches
`V1` (including current column names, required birth dates, author uniqueness
constraints, and the quote-author foreign key). If it does not, correct it explicitly
or use the reset procedure above; baselining does not repair an old schema.
For the first startup only, set `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true`
in the backend environment, or pass `--spring.flyway.baseline-on-migrate=true`
when launching the JAR. Flyway records the existing schema at version 1 without
recreating tables, then applies V2-V9 while preserving data. Remove this override
after successful startup; by default Flyway refuses unversioned nonempty databases
to avoid silently adopting the wrong database. Do not manually pre-create the index.
Index creation can take time and require table locks; schedule deployment accordingly.
Update any server-local `application.properties` override from `ddl-auto=update`
to `validate` as well.

**MySQL integration tests:** Normal `mvn test` covers HTTP compatibility using mocks,
category, character and candidate API/persistence with H2, and the V6-V9 catalogs,
descriptions, relationships, candidate import keys and constraints in H2 MySQL mode.
H2 cannot validate MySQL FULLTEXT. To include actual
search and migration tests, set `MYSQL_TEST_URL` to a server-only URL such as
`jdbc:mysql://localhost:3306/`, plus `MYSQL_TEST_USERNAME` and `MYSQL_TEST_PASSWORD`,
then run `mvn test`. Use a dedicated local/test MySQL 8.0+ instance, never production.
The account must be able to create/drop databases. Tests create uniquely named
`quote_db_search_test_*` databases and remove only those databases afterward;
if interrupted, remove the leftover test databases manually.

From the repository root in **Git Bash**, run:

```bash
export MYSQL_TEST_URL='jdbc:mysql://localhost:3306/'
export MYSQL_TEST_USERNAME='root'
read -r -s -p 'Local MySQL password: ' MYSQL_TEST_PASSWORD
printf '\n'
export MYSQL_TEST_PASSWORD

mvn -Dtest=QuoteSearchMySqlTest test

unset MYSQL_TEST_PASSWORD
```

Replace `root` with your local test account. The URL must end with `/` and must
not include a database name. This runs the MySQL search/migration tests, including
stemming on creates/updates and a multi-batch backfill of an existing V2 database;
without `MYSQL_TEST_URL`, they are skipped even if MySQL is running. To run the
full suite, replace the Maven command with `mvn clean install`.

### Google login

Browsing authors, characters and quotes is public. Creating, updating, or deleting
published resources requires a Google-authenticated session and a valid CSRF token.
Candidate staging endpoints are temporarily anonymous, with CSRF still required
for writes; see [Candidate staging](#candidate-staging).
Any signed-in Google user can write; there are no editor/admin roles yet.

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend environment
(IntelliJ: **Run > Edit Configurations > Backend > Environment variables**).
Keep credentials in local, Git-ignored IDE settings, never in tracked files or `VITE_*` variables.
Both are required to start the backend. Register this exact callback in the
Google web OAuth client:

```text
http://localhost:8080/login/oauth2/code/google
```

Start **Full Stack** and open `http://localhost:5173`. Choose **Login > Continue
with Google**. Spring Security handles the authorization-code OIDC flow and
returns to the frontend after login. Cancelled or failed login returns with an
error message while public browsing remains available. The menu shows your name
and **Logout** after login. Use `localhost` consistently, not `127.0.0.1`.

The browser uses an HttpOnly, SameSite=Lax session cookie; Google tokens and
credentials are not exposed to React or stored in browser storage.
Authentication endpoints:
- `GET /api/auth/me`: minimal current-user DTO or `{"authenticated":false}`.
- `GET /api/auth/csrf`: session-bound token and header name, with caching disabled.
- `POST /api/auth/logout`: requires CSRF, invalidates the session, returns 204.

The API client includes cookies and fetches a fresh CSRF token before each write.
Direct API clients and Swagger writes must likewise send the session cookie and
the header/token returned by `/api/auth/csrf`. Unauthenticated protected requests
return 401 when CSRF is valid; missing/invalid CSRF returns 403. Anonymous
seed/import scripts cannot write published content without authentication.
Anonymous clients can write candidate staging data using a session-bound CSRF token.

`seed-data.sh` prompts for the `JSESSIONID` cookie value from a signed-in session
for the selected base URL, fetches its CSRF token, and includes both on seed
requests. Sign into the site first and copy the cookie value from browser
developer tools; do not save or share it. The session ID is sensitive and
expires when the session ends.

The seed script also requires **jq** (`sudo apt install jq` on Ubuntu or
`scoop install jq` on Windows with Scoop). After V6 is deployed, the catalogs
already exist: the script reads `/api/categories` and resolves labels to IDs
instead of inserting duplicate catalog entries or assuming fixed IDs.
Deploy V8 before seeding characters. The script creates Prince Hamlet (`Hamlet`)
and Jaques (`As You Like It`) and links them to the existing "To be, or not to be"
and "All the world's a stage" seed quotes respectively, keeping Shakespeare as
their author. Other seed quotes omit the optional character association.
This only affects newly seeded data; it does not update quotes already in the database.
It creates 7 authors, 2 characters and 20 quotes with sample tone, theme, form, and known
source selections, including multiple selections in each dimension. Sources
not identified by the existing seed metadata are left unassigned rather than
invented. In `create_quote`, arguments 6-9 are optional tone, theme, form, and
source labels; separate multiple labels with `|`. Omitting them sends empty
arrays. Optional argument 10 is a positive character ID returned by character
creation; omit it for quotes without a character. Missing/duplicate catalog
labels or failed requests stop the script;
earlier writes are not rolled back. It is not an idempotent import.

Run `bash tests/seed-data.test.sh` in Bash to check seed payloads and character
creation failure handling with mocked HTTP requests; it does not contact a database.

`FRONTEND_URL` controls the fixed post-login destination (default
`http://localhost:5173`; supply an origin without a trailing slash). Production
OAuth setup is still required before deploying these changes: configure a
production Google client and HTTPS callback, set the backend credentials and
`FRONTEND_URL`, enable secure session cookies, and configure trusted proxy headers.
nginx must forward `/oauth2/` and `/login/oauth2/` to the backend as well as `/api/`.
Do not expose the session over production HTTP.

### Testing API
- Swagger UI: http://localhost:8080/swagger-ui.html
- Frontend UI: http://localhost:5173
- Or use `curl`, Postman, etc.

### Building
**Backend:**
```bash
mvn clean package
```

**Frontend:**
```bash
cd frontend
npm run build
# Output: frontend/dist/ (static files)
```

## Adding New Entities

### Backend Template
1. Create entity in `src/main/java/org/gilgood/entity/NewEntity.java`
   - Use `@Entity`, `@Table`, `@Id`, `@GeneratedValue`
   - Define fields with appropriate `@Column` annotations
2. Create DTO in `src/main/java/org/gilgood/dto/CreateNewEntityRequest.java`
   - Exclude ID field
   - Only include fields that should be set via API
3. Create mapper in `src/main/java/org/gilgood/mapper/NewEntityMapper.java`
   - Extend pattern: `@Mapper(componentModel = "spring")`
   - MapStruct auto-maps matching field names
4. Create repository: `src/main/java/org/gilgood/repository/NewEntityRepository.java`
   - Extend `JpaRepository<NewEntity, Long>`
5. Create controller in `src/main/java/org/gilgood/controller/NewEntityController.java`
   - `@RestController`, `@RequestMapping("/api/newentities")`
   - Inject mapper and repository
   - Define GET/POST endpoints
6. Add a versioned Flyway migration for the new tables, columns, and indexes

See existing `Author` entity for reference.

### Frontend Template
1. Create API calls in `frontend/src/api.js`:
   ```javascript
   newEntities: {
     list: () => fetch(`${API_BASE}/newentities`).then(r => r.json()),
     create: (data) => fetch(`${API_BASE}/newentities`, {...})
     // etc.
   }
   ```
2. Create component: `frontend/src/NewEntityList.jsx`
   - Use `useEffect` to call `api.newEntities.list()`
   - Render data in JSX
3. Add styles: `frontend/src/NewEntityList.css`
4. Import in `App.jsx` and render

## Deployment

### GitHub Actions CI/CD
This project uses **GitHub Actions** with a self-hosted Ubuntu runner for automated building and deployment. See [`UBUNTU-SETUP.md`](UBUNTU-SETUP.md) for complete setup instructions.

**Workflow**: `.github/workflows/build-deploy.yml`
- Triggers on push to `main` branch only (production deployment)
- Pull requests do not trigger deployment
- Builds backend (Maven) and frontend (Node.js)
- Deploys to Ubuntu runner
- Restarts services and verifies health

### Prerequisites on Ubuntu
- Java 25 (Spring Boot 3.5.0 requirement)
- Maven 3.9+
- Node.js 24 LTS
- npm 11+
- MySQL 8.0+
- GitHub Actions Runner (self-hosted)

**See [`UBUNTU-SETUP.md`](UBUNTU-SETUP.md) for step-by-step installation.**

### Deployment Architecture
```
GitHub Repository
    ↓
Actions Workflow (self-hosted runner on Ubuntu)
    ├─ Build backend: mvn clean package
    ├─ Build frontend: npm run build
    ├─ Deploy JAR: /opt/quote-db/quote-db-1.0-SNAPSHOT.jar
    ├─ Deploy frontend: /var/www/quote-db/ (nginx static root)
    ├─ Restart services: systemctl restart quote-db, systemctl reload nginx
    └─ Health checks: curl http://localhost:8080/api/authors
```

### Access Points (after deployment)
- **Frontend**: `http://your-server-ip/` (via nginx)
- **Backend API**: `http://your-server-ip:8080/api/`
- **Swagger UI**: `http://your-server-ip:8080/swagger-ui.html`
- **MySQL**: Accessible locally on Ubuntu (auto-creates `quote_db` database)

### Service Management (on Ubuntu)
```bash
# Check status
sudo systemctl status quote-db
sudo systemctl status nginx

# Restart services (manual deployment)
sudo systemctl restart quote-db
sudo systemctl reload nginx

# View logs
sudo journalctl -u quote-db -n 50
sudo tail -f /var/log/nginx/error.log
```



## Future Considerations

- **Authentication/Authorization**: Implement JWT or OAuth2
- **Pagination**: Add `@PageableDefault` to list endpoints
- **Validation**: Use `@Valid` and Jakarta validation annotations
- **Error Handling**: Implement `@ControllerAdvice` for consistent error responses
- **Frontend Components**: Forms for create/edit, delete confirmations, pagination UI
- **State Management**: Consider Redux or Zustand for complex state
- **Caching**: Redis/Spring Cache for frequently accessed data
- **Semantic Search**: Consider vector search if word-based MySQL FULLTEXT is insufficient
- **Analytics Endpoints**: Aggregations and reporting queries

## License

[Specify license]
