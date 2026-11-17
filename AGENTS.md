# Architecture & Learnings

## Documentation Maintenance

- This repository has two READMEs: root `README.md` for application-wide/API
  documentation and `frontend/README.md` for frontend behavior and development.
- Check both READMEs when changing features; update each affected document and
  keep shared behavior consistent. Update `AGENTS.md` when architecture,
  conventions or implementation guidance changes.

## AI Editorial Lookups

- Shared AddAuthorDialog exposes draft-only Gemini lookup beside Date of birth/death,
  Place of birth and Biography
  for create/edit/review. Single POST `/api/ai/lookups` requires login and CSRF,
  accepts `{type, context}`, and never writes published/candidate content.
  AiLookupRequest.Type permits AUTHOR_DATE_OF_BIRTH, AUTHOR_DATE_OF_DEATH,
  AUTHOR_PLACE_OF_BIRTH and AUTHOR_BIOGRAPHY, requiring
  nonblank context.fullName (255 max); missing/unsupported types or invalid
  context return 400 before any provider call. No client-supplied prompts.
- AiLookupController owns the shared endpoint; AiLookupService dispatches
  server-defined types and owns prompts/result validation/normalization.
  Add future author/quote lookup types here without controllers/routes per
  field. Keep context structured and validated as supported types expand.
  AiLookupResponse uses FOUND with a normalized string value or UNKNOWN.
- GeminiClient handles provider transport only, using backend-only `GEMINI_API_KEY`;
  optional `GEMINI_MODEL` defaults to free-tier-capable `gemini-3.5-flash-lite`.
  Missing credentials must not prevent startup or manual entry. Do not expose
  keys/provider response bodies, retry automatically, or fall back to paid models.
- Prompt requests an exact MM/DD/YYYY at 99.9% confidence or IDK, with explicit
  abstention for ambiguity/incomplete dates. This is not a calibrated accuracy
  guarantee. Validate strict calendar/nonfuture dates; return FOUND plus ISO
  date in value or UNKNOWN. Invalid/blocked/truncated output is an explicit error.
- Death-date prompt abstains for living authors/unconfirmed deaths and forbids
  burial-date substitution or prediction. Both date lookups share strict parsing
  and UI handlers; only the selected field changes, death date stays optional,
  and a pending lookup prevents starting either lookup again.
- Birthplace prompt requests 99% confidence and prefers city/town, administrative
  divisions and country, omitting uncertain components even if only a city is
  known. Return IDK for ambiguous identities or entirely unknown birthplaces;
  never request a location more specific than the city or town.
- Biography prompt requests factual professional prose without controversies,
  person names/aliases, birth/death dates/years or birthplace. All lookup prompts
  describe a person, not an author: do not assume a writing profession.
  Biography requests best-effort reliable facts without IDK instructions or a
  confidence threshold; dates/birthplace retain their abstention rules. An
  encyclopedia-style opening may be a fragment to avoid attributing the person's
  achievements to anyone in that role. At most three
  sentences in one paragraph; backend uses English BreakIterator for sentence
  bounds. Text results must be single-line and fit existing limits (place 255,
  bio 1024); reject invalid output explicitly, never truncate. Semantic rules and
  facts remain prompt-based and require editorial verification.
- Shared authorLookups metadata and lookupField handler populate only the target
  draft field for dates/text, preserving other fields and optional-field semantics.
- Preserve draft values on uncertainty/errors. Disable fields/saves/review
  mutations during lookup, allow dismissal, ignore responses after unmount,
  and preserve published-author/promotion-retry locks. Suggestions require
  manual verification and normal Save; never automatically publish.

## Candidate Staging

- V9 introduces CandidateAuthor and CandidateQuote in separate staging tables.
  Keep candidate content out of published author/quote queries and UI.
- Candidate reads, imports and review-field updates permit anonymous access by
  explicit request. Preserve CSRF on mutations. Promotion endpoints require
  authentication because they create published content. Admin authorization is
  deferred; do not describe candidate endpoints as admin-restricted.
- POST imports one candidate, with a lowercase ASCII stable importKey unique
  per candidate type. Repeat keys return stored DTOs unchanged, preserving rejected
  state, edits and original provenance. Conflicting source/page or quote parent
  is 409; concurrent uniqueness conflicts are retryable, never duplicate rows.
- POST `/api/candidates/batch` atomically imports required `authors`/`quotes`
  arrays (0-100 each, at least one candidate). Quotes use
  `candidateAuthorImportKey` instead of an ID, referencing this batch or a stored
  author. Process authors first; return normal stored DTO arrays in input order.
  Reuse single-import validation/identity rules; any failure rolls back the batch.
  This endpoint also allows anonymous access but requires CSRF.
  The Wikiquote importer buffers 100 candidates by default (`--batch-size 1-100`)
  and at most 512 KiB of UTF-8 JSON, fetching CSRF once per batch. Flush the tail
  before replacing the report; counters reflect only confirmed batch responses.
- Store source, page/revision IDs, dump date, source title/URL; quotes also retain
  raw wikitext and optional source notes. These and candidate quote parent are
  immutable. CandidateRecord and ImportCandidateRequest share provenance fields;
  CandidateMapper uses MapStruct for conversion, and CandidateService owns transactions.
- POST `/api/candidate-authors/{id}/promote` creates and links a published Author
  from CreateAuthorRequest and approves the candidate in one transaction.
  POST `/{id}/link` links an existing published author. POST
  `/api/candidate-quotes/{id}/promote` creates and links a Quote from
  CreateQuoteRequest and approves the candidate atomically. These endpoints
  require authentication and CSRF; pessimistic candidate-row locks serialize
  retries/concurrent requests, returning the existing linked DTO without
  duplicate publication. Quote promotion also locks its candidate author and
  fails with 409 if that author was rejected. Rejecting an author rejects every
  linked quote; later imports for rejected authors conflict.
- GET/HEAD lists use existing Pagination/PagedModel, ID ascending and optional
  status; quotes additionally filter candidateAuthorId with AND in the database.
- PUT fully replaces review name/text, required PENDING/APPROVED/REJECTED status
  for authors and PENDING/APPROVED/REJECTED/SNOOZED status for quotes
  and optional publication link. Null/omitted links clear. Validate referenced IDs
  atomically; links never cascade. Publication links restrict deletion with visible 409.
- Quote deletion conflicts use RFC 9457 ProblemDetail with stable
  `code=QUOTE_LINKED_TO_CANDIDATES` and
  `type=urn:quote-db:problem:quote-linked-to-candidates`, not message matching.
  Only this 409 offers the signed-in recovery dialog. Explicit DELETE
  `candidateStatus=PENDING|REJECTED` invokes QuoteDeletionService: lock the quote,
  update all linked candidate statuses/clear publication links, then delete/flush
  in one transaction. Failure rolls back all changes. Preserve candidate text,
  provenance, candidate-author links and published authors/characters.
  Recovery uses published-content authentication/CSRF, never anonymous candidate
  endpoint permissions. Successful recovery refreshes quote totals/candidate counts
  and removes the deleted quote from CandidateReview's in-memory publication cache.
- CandidateReview replaces the right-side placeholder only for signed-in users.
  Review next candidate fetches the next PENDING quote; Review snoozed fetches
  the next SNOOZED quote, both page 0/size 1 and oldest ID first. GET does not
  reserve the item. SNOOZED applies only to candidate quotes and is excluded
  from pending review and pending counts; show pending, snoozed and author counts
  in the review panel.
  Reuse AddAuthorDialog/AddQuoteDialog for review, preserving normal creation/editing.
  Duplicate quote review actions in the fixed dialog header, sharing handlers,
  validation and disabled/retry state with the footer; header approval submits
  the same form through its form ID. Create/edit keep footer-only actions.
  Approved candidate authors preselect their publication link; otherwise prompt
  for author creation (including required birth date). Closing leaves author empty.
  Author Save and quote Approve call the corresponding atomic promotion API.
  Existing-author selection uses atomic author linking. After an ambiguous
  network/5xx failure, promotion retries submit the same locked form payload;
  definite client errors leave the form editable. Backend idempotency recovers
  a successful commit even when its response was lost. Reject updates only
  stored quote review fields/status; closing makes no candidate quote changes.
  Snooze updates only the candidate status, preserving stored quote text/link,
  then continues the pending queue. Successful quote approval/rejection
  automatically fetches and opens the next item from the queue being reviewed;
  cancellation and failed mutations never advance the queue.
  Do not allow rejecting a quote after publication from the review form; the
  explicit quote-deletion recovery above is separate. Reload/logout and concurrent
  reviewers still do not reserve queue items, but transactional/idempotent
  promotion prevents duplicate publication.
  ExternalLink allows only HTTP/HTTPS and opens references with noopener/noreferrer.
- Quotes have optional `primaryReference` and `secondaryReference` (double-sourcing; neither is
  required). Flyway V10 renamed `reference` to `primary_reference`, preserving data, and added
  `secondary_reference`. Candidate tables are unchanged; candidate sourceUrl prefills the primary.
- No candidate DELETE, automatic matching or enrichment yet. CandidateControllerTest exercises
  H2-backed endpoints with OSIV disabled; CandidateMigrationTest verifies V9.

## DTO-to-Entity Mapping Strategy

**Tool**: MapStruct v1.6.0 (compile-time code generation)

### Why MapStruct?
- **Compile-time generation**: Type-safe, zero runtime reflection overhead
- **Scalability**: Automatically maps fields with matching names between DTOs and entities
- **Low boilerplate**: As entities grow with more fields, no additional mapping code needed
- **Performance**: Generated Java code is as fast as manual mapping

### How It Works
1. Define a mapper interface annotated with `@Mapper(componentModel = "spring")`
2. MapStruct processor generates implementation at compile time
3. Spring automatically wires the generated mapper as a bean
4. Use `authorMapper.toEntity(request)` in controllers

### Example
```java
@Mapper(componentModel = "spring")
public interface AuthorMapper {
    Author toEntity(CreateAuthorRequest request);
}
```

When `Author` adds fields like `birthYear`, `nationality`, etc., they'll automatically be mapped if `CreateAuthorRequest` has matching field names and types.

---

## Java & Spring Boot Compatibility

- **Java 27**: Not yet supported by Spring Framework 6.2.7 (class file major version 71 incompatible with ASM)
- **Java 25**: Stable, fully compatible with Spring Boot 3.5.0
- **Spring Boot 3.5.0**: Latest version supporting Java 25

---

## Hibernate/JPA Best Practices

### Issue: StaleObjectStateException with New Entities
**Problem**: Posting entities directly with auto-generated ID (0) causes Hibernate to treat them as existing records.

**Solution**: Use DTOs for input that exclude the ID field. MapStruct maps to a fresh entity instance.

### Database Auto-Creation
Add to JDBC URL:
```
jdbc:mysql://localhost:3306/quote_db?createDatabaseIfNotExist=true
```

---

## Project Structure

```
src/main/java/org/gilgood/
├── Application.java          # Spring Boot entry point
├── controller/
│   └── AuthorController.java # REST endpoints
├── entity/
│   └── Author.java          # JPA entity
├── repository/
│   └── AuthorRepository.java # Spring Data JPA
├── mapper/
│   └── AuthorMapper.java    # MapStruct interface
└── dto/
    └── CreateAuthorRequest.java
```

---

## REST API Design

### Separation of Concerns Rule
**Controllers must never expose entities directly.** Always use DTOs for both input and output:
- **Input**: Use request DTOs (`CreateAuthorRequest`, `UpdateAuthorRequest`)
- **Output**: Use response DTOs (`AuthorResponse`) — map entities via MapStruct before returning

This prevents:
- Unintended field exposure (e.g., internal database IDs, computed fields)
- ORM relationship issues (lazy loading, circular references)
- Tight coupling between API contracts and database schema
- Accidental inclusion of sensitive data

### Full Replacement Update Strategy (PUT)
To avoid ambiguity with partial updates, all PUT endpoints use **full replacement semantics**:

| Method | Semantics |
|--------|-----------|
| **POST** | Create new resource with partial data (defaults for omitted fields) |
| **PUT** | Replace entire resource; any omitted optional fields are deleted |
| **No PATCH** | Not implemented; use PUT for all updates |

**PUT Behavior:**
- Client sends complete replacement (all fields)
- Fields set to null or omitted (if optional) → deleted/cleared in database
- Required fields (e.g., `fullName`) must be provided; missing = 400 Bad Request
- Clean, predictable semantics: no "empty string vs null" ambiguity
- Clients must fetch full resource before updating if partial changes needed

**Example:**

PUT /api/authors/1

// Replace entire author; knownAs and bio are deleted

```json
{
  "fullName": "Jane Doe",
  "knownAs": "Jane",
  "dateOfBirth": "1950-05-15",
  "nationality": "US"
}
```

### Endpoints
- `GET /api/authors` - Returns `PagedModel<AuthorResponse>`; optional `query` searches fullName or knownAs
- `GET /api/authors/{id}` - Returns full `AuthorResponse` details for one author
- `POST /api/authors` - Accepts `CreateAuthorRequest`, returns `AuthorResponse`
- `PUT /api/authors/{id}` - Accepts `UpdateAuthorRequest` (full replacement), returns `AuthorResponse`
- `DELETE /api/authors/{id}` - Deletes author

### Implementation Pattern
```java
@GetMapping
public PagedModel<AuthorResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    var pageable = Pagination.request(page, size).withSort(Sort.by("id"));
    var authors = query != null && !query.isBlank()
        ? repository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase(
                query.trim(), query.trim(), pageable)
        : repository.findAll(pageable);
    return new PagedModel<>(authors.map(mapper::toResponse));
}
```

Author, character and quote lists use zero-based `page` (default 0) and `size` (default 20,
1-100); invalid values return 400. Return Spring Data's stable `PagedModel`
envelope (`content` and `page` metadata), not raw `PageImpl` or entities.
Paginate/count in the database with all filters applied. List ordering is ID
ascending, except quote text search uses relevance descending then ID ascending.
Frontend `listPage` methods expose pages; existing `list` helpers collect all
pages for complete author pickers. QuotesList uses `quotes.listPage` with bottom
Previous/Next controls, one-based labels, and sizes 10/20/50/100 (default 20).
Size and filter changes reset API page to 0, retaining size. Failures are
retryable; writes refresh totals and recover pages that no longer exist.

### Author Search

- Public GET/HEAD `/api/authors` accepts only the new optional `query` filter.
  Trim nonblank queries; omitted/blank queries preserve normal listing.
- Use `AuthorRepository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase`
  with the same trimmed query for both fields for case-insensitive substring
  matching on fullName or knownAs, with database pagination/counting and ID
  ascending order. Spring Data escapes LIKE wildcards; treat `%`, `_`, and `\`
  literally. Authors matching both fields appear once. Do not reuse quote FULLTEXT stemming/relevance.
- `api.authors.list(query = '')` collects every matching page with the same
  query. `api.authors.listPage({query, page, size})` returns one page.
  No-query calls must still load complete author pickers.
- Sidebar uses `authors.listPage` with size 10, initially requesting page 0.
  More authors at the bottom appends the next 10 matches with the same query;
  hide it after the last page. Keep loaded authors visible during more-page
  loading/failure, prevent duplicate loads, and retry the same failed page.
  Searches, clearing, and refreshes reset to page 0; ignore outdated more-page
  responses as well as initial-page responses. Other pickers keep `authors.list()`.
- Sidebar owns independent draft/submitted author search state. Submit immediately
  via Enter or the search icon, or automatically after a 500 ms typing pause.
  Further typing restarts the delay; submission, clearing, and unmount cancel
  pending searches. Clearing restores the first unfiltered page immediately. Keep query on
  author refresh and retry/resubmission.
- Search narrows the author list only, never clears the selected author (even
  when hidden) or changes quote text/category filters.
  Labels continue to prefer knownAs over fullName.
- Keep the field compact above the list, keyboard accessible, and theme-aware.
  Show loading, no matches, and visible retryable errors separately; clear stale
  results on first-page reload, retain results on more-page failure, and ignore outdated requests.
- AuthorControllerTest and AuthorRepositoryTest cover query/blank handling,
  pagination, fullName-or-knownAs matching, case-insensitive substrings, and literal
  wildcards. API and Sidebar tests cover encoding, all-pages query retention,
  submission/clearing, retry, refresh, filter independence, and stale responses.

### Characters

- Characters are fictional speakers, not authors. Every quote still requires an
  author (the writer); its character is optional, including for narration.
- Character fields are generated `id`, required nonblank `fullName` (255 max),
  optional `knownAs` (255), `description` (1024), and `workTitle` (255).
  Names are not unique; distinct works can have identically named characters.
  Blank known-as names normalize to null, as for authors.
- CRUD at `/api/characters` follows AuthorController:
  CharacterRepository, MapStruct CharacterMapper, separate create/update request
  DTOs and CharacterResponse. Never accept client IDs or expose entities.
  PUT replaces all editable fields and clears omitted/null optional fields.
- GET/HEAD list and single-character endpoints are public; all writes require
  authentication and CSRF. List uses the same pagination validation as authors,
  ID ascending, and optional trimmed, case-insensitive literal fullName-only
  substring `query`, with database filtering/counting.
- Flyway V8 creates `characters` and nullable indexed `quotes.character_id`,
  leaving existing quotes unassigned. Keep V1-V7 unchanged. The foreign key
  restricts deletion; deleting a linked character returns visible 409 until
  quotes are explicitly unlinked. Missing characters return 404 on CRUD.
- Quote POST/PUT accepts optional `characterId`; null/omitted means unassigned
  (and clears on PUT). Unknown/nonpositive IDs return field-specific 400 and
  reject the entire write. `authorId` remains required even with a character.
  Responses include a CharacterResponse when assigned, otherwise omit the field
  under the existing non-null JSON policy. No cascade to characters or authors.
- Do not infer or require a character from Source categories. Frontend quote
  forms always send characterId: preserve the existing assignment on edits,
  preselect the current character filter on creation, and send null when
  No character / narration is selected. API clients retaining the character
  must also send characterId on PUT.
- Public quote lists accept optional characterId, combined with author, text
  and category filters using AND. Apply it in database queries and counts,
  including native FULLTEXT search; preserve relevance and ID ordering.
- `api.characters.list(query)` collects all matching pages for quote pickers;
  `listPage({query, page, size})` loads one page. Reads include session cookies;
  create/update use fresh CSRF tokens, as for authors.
- Sidebar shares NameFilter for independent author/character searches, with
  500 ms debounce, immediate submission/clearing, 10-item pages, More controls,
  retryable failures and stale-response protection. Searching or clearing one
  list never changes selected IDs or other quote filters. Character labels in
  filters/pickers prefer knownAs and append workTitle in parentheses.
- Character names on quotes and Sidebar Info buttons open AboutCharacterDialog.
  Details are public; only authenticated users can create/edit characters.
  AddCharacterDialog shares characterFields definitions with details, trims
  text, sends cleared optional fields as null, keeps failed drafts and blocks
  duplicate submissions/dismissal while saving. Use native dialogs and restore
  focus to the invoking control or container. Character deletion has no UI.
- AddQuoteDialog loads complete character options with visible retryable errors
  and disables save during loading/failure. Never silently clear unavailable
  assignments. Nested character creation selects the result without losing
  quote fields/categories; cancelling a quote does not delete a saved character.
- Character changes refresh Sidebar and quote results without clearing filters.
  Quotes always use per-quote attribution, never selected-author/character
  headings: author alone, or character in italicized work title by author.
  Omit the "in work title" phrase when absent. Both names are accessible buttons
  opening details without expanding the quote or changing filters.
- Characters.test.jsx and API tests cover filters, pagination, debounce, stale
  responses, retry, create/edit dialogs, focus, assignment preservation/clearing,
  uniform attribution and italicized work titles.
- CharacterControllerTest covers CRUD, validation, search/pagination, security,
  quote reads/replacement, atomic invalid writes and deletion conflicts with
  Open Session in View disabled. CharacterMigrationTest exercises V8 constraints
  and data preservation in H2 MySQL mode; QuoteSearchMySqlTest also covers V8 on
  the real MySQL upgrade path when MYSQL_TEST_* variables are set.

### Quote Categorization

- Four defined dimensions: Tone (reader effect), Theme (subject), Form
  (construction), and Source (origin type, distinct from precise `location`).
- Every dimension is optional and multi-select. Do not require categories on quotes.
- Flyway V6 creates separate `tones`, `themes`, `forms`, and `sources` lookup
  tables (auto-increment IDs, unique names up to 32 characters) and corresponding
  `quote_*` junction tables with composite primary keys and foreign keys.
- V7 adds required descriptions (up to 255 characters) and backfills all 36
  options by name, preserving IDs and selections. Keep deployed V6 unchanged.
- Catalog sizes are 7 tones, 12 themes, 6 forms, and 11 sources; see README.md
  for the approved labels. Form excludes Excerpt; Source includes Poem while
  Form includes Verse. Existing quotes start with no selections.
- Public GET/HEAD `/api/categories` returns one DTO containing `tones`, `themes`,
  `forms`, and `sources`, each an array of `{id, name, description}` sorted by ID.
  Catalogs have no write endpoints; change options via new migrations.
- Quote POST/PUT accepts `toneIds`, `themeIds`, `formIds`, and `sourceIds`.
  CategoryService resolves IDs in their own dimension; unknown, null-element,
  zero, or negative IDs return 400 with a visible field-specific error.
  Duplicate IDs are deduplicated.
- Quote responses expose `tones`, `themes`, `forms`, and `sources` as sorted
  `{id, name, description}` DTO arrays, never entities; empty dimensions return `[]`.
  CategoryMapper handles DTO conversion and QuoteMapper resolves inputs through
  CategoryService.
- Public `GET /api/quotes` accepts optional `toneIds`, `themeIds`, `formIds`, and
  `sourceIds` query parameters for filtering. Repeated IDs match any selected ID
  within a dimension; selected dimensions combine with each other, `authorId`,
  and text search using AND. Category filtering also works when `query` is
  omitted or blank.
- PUT uses full replacement: omitted, null, or empty category arrays clear
  selections. Include all selections to retain them.
- Quote create/update and response mapping run inside transactions to make
  invalid writes atomic and support lazy category collections without relying
  on Open Session in View. Batch fetching avoids a category query per quote.
- Relationships never cascade persistence/removal to catalog entries.
  Deleting a quote removes only its associations, not categories or its author.
- Frontend AddQuoteDialog loads catalogs via `api.categories.list()` and uses
  QuoteCategoryFields for optional checkbox groups, selection counts, and clear
  actions. Groups use native details/summary, start collapsed, and keep selection
  counts visible in their summaries. Shared create/edit/review quote forms use
  asterisks for required fields and label hovertext for guidance.
  Options/IDs come from the API, never hardcoded frontend catalogs.
- Checkbox labels and quote tags use backend descriptions as native hover
  text. Checkboxes associate descriptions via aria-describedby; tags include
  screen-reader text. Missing descriptions remain compatible with older backends.
- Quote edit drafts map response category DTOs to IDs in their own dimension.
  Every create/update submits all four category ID arrays, including empty ones.
  Scalar-only edits preserve selections; deselecting/clearing intentionally removes them.
- Catalog errors are visible and retryable without discarding drafts. Save is
  disabled during loading/failure; never silently save with incomplete controls.
  Category selections survive author changes, nested author creation, and failed writes.
- QuotesList shows selected category labels grouped by dimension in expanded
  details, for anonymous/authenticated browsing and search. Hide empty groups.
  Controls/tags wrap on narrow screens and use CSS theme variables.
- Left navigation provides author/character selection and optional category checkboxes.
  Bound the author-list height so it cannot consume the navigation; category
  selections combine across dimensions and with author/character/text filters using AND.
  Category catalog failures must remain visible and retryable.
- `npm test` in frontend runs existing Node API tests and Vitest/jsdom category,
  quote-attribution, character, and author-dialog interaction tests. Keep the Vitest include scoped to `*.test.jsx`
  so Node's `api.test.js` is not executed by both runners.
- `seed-data.sh` requires jq and loads `/api/categories` to resolve labels rather
  than hardcoding IDs. Optional arguments 6-9 to `create_quote` accept tone,
  theme, form, and source labels separated by `|`; samples include multi-select
  categories. Do not invent unknown source types.
- `seed-data.sh` creates Prince Hamlet and Jaques through `/api/characters` and
  passes returned IDs as optional argument 10 to `create_quote` for the existing
  Hamlet and As You Like It quotes. Keep Shakespeare as author; other samples
  omit characterId. Requires V8; the seed script does not update existing rows.
- QuoteCategoriesTest covers real H2-backed API writes, replacement, validation,
  security, and reads with Open Session in View disabled. CategoryMigrationTest
  executes V6/V7 in H2 MySQL mode; QuoteSearchMySqlTest also verifies V6/V7 during
  the real MySQL upgrade path and category-filtered text search when MYSQL_TEST_*
  variables are set.

---

## Build & Runtime

### Backend
- **Build System**: Maven 3.9+
- **Java Version**: Java 25
- **Swagger UI**: Available at `http://localhost:8080/swagger-ui.html`
- **Auto-configuration**: SpringDoc OpenAPI auto-discovers REST endpoints

### Frontend
- **Framework**: React 18 + Vite 8
- **Runtime**: Node.js 24 LTS + npm 11+
- **Build Output**: Static files in `frontend/dist/`
- **Dev Server**: `npm run dev` → `http://localhost:5173`
- **Production Build**: `npm run build` → optimized static files

### CORS Configuration
CORS is enabled for local development:
```java
// src/main/java/org/gilgood/config/CorsConfig.java
registry.addMapping("/api/**")
    .allowedOrigins("http://localhost:5173", "http://localhost:3000")
    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
```

This allows the frontend dev server to call the backend API without browser CORS blocks.

---

## Frontend Architecture

### Dialog Conventions

- Keep quote, author and character create/edit/review forms compact and consistent.
  Mark mandatory labels with ` *`, never `(required)` or `(optional)`, and preserve
  native `required` validation. Avoid introductory requirement/optional-field paragraphs.
- Put concise field guidance in label `title` hovertext; keep author/character
  descriptions in their shared field definitions. Character guidance must distinguish
  fictional speaker from author. Keep labels associated with controls.
- Use `DialogHeader` outside the scrolling `.dialog-body`, a top-right close button,
  and 16px of body top padding. Use theme variables and wrapping for narrow screens.
- Create/edit actions stay at the bottom. Only Review Quote duplicates Reject,
  pending-only Snooze and Approve in the fixed title bar; share handlers, form
  validation, disabled/saving state and publication retry behavior across both copies.
- Quote category dimensions use independent native details/summary disclosures,
  initially collapsed, with selection counts visible when collapsed. Collapsing
  never clears selections; retain explicit Clear actions inside each group.
- Removing guidance must not change full-replacement payloads, draft/error handling,
  focus restoration, or save/dismissal guards. Document immediate publication of
  nested authors/characters and optional-field clearing in the READMEs.

### Project Structure
```
frontend/
├── src/
│   ├── App.jsx                   # Main app component with layout
│   ├── App.css                   # Layout styles
│   ├── main.jsx                  # React entry point
│   ├── api.js                    # Backend API client
│   ├── authorFields.js           # Shared author field definitions for forms/details
│   ├── index.css                 # Global styles & theme variables
│   ├── components/
│   │   ├── Header.jsx            # Top header with logo, search, menu
│   │   ├── LoginDialog.jsx       # Optional Google OIDC login dialog
│   │   ├── AboutAuthorDialog.jsx # Public author details with authenticated edit action
│   │   ├── AddAuthorDialog.jsx   # Shared author creation/editing form
│   │   ├── AboutCharacterDialog.jsx # Public character details with authenticated editing
│   │   ├── AddCharacterDialog.jsx # Character creation/full-replacement editing
│   │   ├── NameFilter.jsx        # Shared paginated author/character search
│   │   ├── Sidebar.jsx           # Left sidebar: author/character/category filters
│   │   ├── QuotesList.jsx        # Center content: quotes display
│   │   ├── CandidateReview.jsx   # Signed-in right sidebar: candidate review
│   │   └── Placeholder.jsx       # Signed-out right sidebar placeholder
│   └── styles/
│       ├── Header.css            # Header styling
│       ├── LoginDialog.css       # Login modal and Google button styling
│       ├── AboutAuthorDialog.css # Author details modal styling
│       ├── Sidebar.css           # Left sidebar styling
│       ├── QuotesList.css        # Center content styling
│       └── Placeholder.css       # Right sidebar styling
├── public/                       # Static assets
├── dist/                         # Production build (generated)
├── .env.local                    # Dev environment: VITE_API_URL=http://localhost:8080/api
├── package.json
└── vite.config.js
```

### Layout Design (2026 Modern Aesthetic)

**Header (Full Width)**
- Left: "Quotes DB" logo (accent color)
- Center: Quote search bar; submit with Enter or search icon, scoped to selected author or all quotes
- Right: "Quote of the Day" button + hamburger menu (Login above About)
- Neutral color scheme with subtle borders

**Main Content (Below Header)**
- **Left Sidebar (25% width)**: Quote filter panel
  - Displays independently searchable, paginated authors and characters from backend
  - Click author/character to select/deselect and filter quotes
  - Active selections highlighted with accent color
  - Scrollable if many authors

- **Center Content (50% width)**: Quote display area
  - Selection prompt when no author, character, search query, or category filter is active
  - Uniform attribution beneath each quote; no selected-author/character headings
  - Character in italicized work title by author, or author alone; omit absent work titles
  - Clickable author/character names open their public details dialogs
  - Scrollable for long quote lists

- **Right Sidebar (25% width)**: Candidate review for signed-in users
  - Review next candidate opens shared author/quote review forms
  - Signed-out users retain the animated "Coming Soon" placeholder
  - Both review controls and the placeholder are top-aligned with pane padding

**Color Palette (CSS Variables)**
- `--text`: #2d3436 (dark text, light mode)
- `--bg`: #fafbfc (light background)
- `--sidebar-bg`: #f8f9fa (sidebar background)
- `--border`: #e9ecef (neutral borders)
- `--accent`: #5f4b8b (purple for interactive elements)
- Dark mode support: Automatically adjusts colors based on `prefers-color-scheme`

**Dark Mode Requirements**
⚠️ **CRITICAL**: Always use CSS variables for colors, never hardcode hex values. Dark mode is enabled via `prefers-color-scheme` media query in `index.css`.

When adding new components or styling:
- Use `var(--text)`, `var(--bg)`, `var(--sidebar-bg)`, `var(--border)`, `var(--accent)` instead of hardcoded colors
- Test in both light and dark mode (toggle in browser dev tools or OS settings)
- Common mistake: Using `#fafbfc` or `#f0eff7` for backgrounds breaks dark mode
- Hover states, shadows, and borders must also respect variables

**Typography**
- Font Family: System sans-serif stack (`-apple-system`, `Segoe UI`, etc.)
- Consistent font sizes for hierarchy (h1, h2, h3, body)
- Letter spacing: 0.3px for improved readability

**Responsive Behavior**
- Desktop (1024px+): Full 3-column layout
- Tablet (768px-1024px): Proportional column widths with adjusted padding
- Mobile (<768px): Stacks vertically (header → sidebar → content → right)

### API Client Pattern
```javascript
// src/api.js provides typed API calls
import { api } from './api'

// Usage in components
api.authors.list()      // GET /api/authors
api.authors.get(id)     // GET /api/authors/:id
api.authors.create(dto) // POST /api/authors
api.authors.update(id, dto) // PUT /api/authors/:id
api.authors.delete(id)  // DELETE /api/authors/:id
```

Environment URL is configurable via `.env.local` (dev) or `.env.production` (build).

### Key Components

**Header.jsx**
- Hamburger menu with dropdown ("Login" above "About")
- Login opens LoginDialog; closing it returns focus to the hamburger button
- Loads `/api/auth/me`; signed-in users see their name and Logout instead of Login
- Session lookup, login, and logout errors are visible without blocking public browsing
- Search submits plain text via optional `query`; changing author selection reruns the submitted search, clearing restores browsing
- Quote of the Day button placeholder

**LoginDialog.jsx**
- Native modal dialog with "Continue with Google" and a top-right close icon
- Login is optional; anonymous browsing remains available
- Google button navigates to the backend `/oauth2/authorization/google` endpoint
- Spring Security handles OIDC and stores authentication in the server session, not browser storage
- Do not display a "coming soon" message for Google sign-in
- Native dialog provides modal keyboard focus and Escape dismissal
- Uses theme variables for light/dark mode, with fixed Google brand colors defined in index.css

**Sidebar.jsx**
- Fetches authors and characters through NameFilter on mount and submitted query/refresh
- Compact fullName search submits optional `query` with Enter/search icon or after a 500 ms typing pause; clearing restores the first unfiltered page
- Loads 10 names per list initially with More authors/characters to append pages; searches and refreshes reset to page 0
- Shows loading/no-match/retryable error states and ignores outdated author responses
- Author/character buttons toggle selection; no All authors/characters controls
- Each list search preserves author/character selections and quote text/category filters
- Author/character Info opens existing details dialogs with focus restoration; edits refresh names and quotes without clearing filters
- Character creation is in the quote form only, not the sidebar
- Sidebar.css shares an author height limit (25vh, capped at 233.33px; 91.67px on mobile); characters use 3/5 of it, targeting about five authors/three characters

**QuotesList.jsx**
- Shows a selection prompt when no author, character, search query, or category filter is active
- Searches within all selected author/character/category filters, or all quotes when none are selected
- Uses knownAs when present, otherwise fullName, beneath every quote with no filter-specific headings
- Character attribution is character in italicized work title by author; omit absent work titles
- Per-quote names are keyboard-accessible buttons opening AboutAuthorDialog/AboutCharacterDialog without changing filters or expanding a quote
- Author/character updates refresh matching quote attribution/results and Sidebar while preserving filters
- Preserves backend relevance order
- Shows distinct loading, error, and no-match states; ignores outdated requests after filter changes
- Scrollable quote display with expandable details

**AboutAuthorDialog.jsx / AddAuthorDialog.jsx**
- About this Author is a public, read-only native modal that fetches full details through `api.authors.get(id)`; loading failures are visible and retryable
- Shows full name, known-as name, birth/death dates, birthplace, nationality, biography, and age when available; missing fields display "Not provided"
- Render date-only author values without timezone shifts and preserve biography line breaks
- Only authenticated users see the top-right pencil, which opens AddAuthorDialog prefilled for editing
- Share field definitions through `authorFields.js`; AddAuthorDialog supports both existing creation and full-replacement PUT updates
- Author form labels use asterisks for required fields and hovertext from shared
  `authorFields` descriptions, without an introductory paragraph. Keep top padding
  between the fixed dialog header and form content.
- Submit all editable fields, trim text, and send cleared optional fields as null; full name and birth date remain required
- Preserve drafts on failed saves, including conflicts and expired sessions; prevent duplicate submissions and dismissal while saving
- Cancel returns to unchanged details; successful saves update the details and notify QuotesList/App to refresh other author surfaces
- Use native modal keyboard behavior; restore focus to the pencil after editing and to the invoking name after closing About (or the quotes container if that name was removed)
- Use theme variables and wrapping/scrolling for narrow screens; never expose editing controls to anonymous users

**Placeholder.jsx**
- Decorative component for the signed-out right sidebar
- Animated graphic with gradient background
- Placeholder for ads, recommendations, or other future features

---

## Running Frontend & Backend Together

### IDE-Agnostic Repository Policy

- Keep tracked project configuration IDE-agnostic; do not commit IDE-specific settings or run configurations
- Keep IDE-specific configuration local and Git-ignored, including `.run` directories at any depth and `.idea`
- Document IDE-independent build and run commands as the primary workflow; IDE instructions may supplement them
- Do not force-add ignored IDE files

### Development Mode (with hot reload)

**IntelliJ IDEA**
- Configurations are machine-local; both `.run` and `.idea` are ignored by Git and must not be force-added
- **Frontend** runs `npm run dev` using the project Node.js interpreter
- **Backend** runs `org.gilgood.Application` in module `quote-db` using the existing `ms-25` Java 25 SDK
- **Full Stack** launches Backend and Frontend together
- The existing local **Application** configuration is unchanged
- Requires IntelliJ's JavaScript and TypeScript and Node.js plugins, installed frontend dependencies (`npm ci`), and running MySQL
- Stop existing server instances before launching to avoid port conflicts
- Existing local configurations are preserved; fresh clones must create them in IntelliJ
- See README.md for configuration creation, interpreter configuration, and startup details

**Terminal alternative**

**Terminal 1: Backend**
```bash
# From project root
mvn spring-boot:run
# or in IDE: Run → Run Configuration → Application
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
# Opens http://localhost:5173 (auto-refresh on save)
```

### Google Authentication

- Backend requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables; never commit credentials or put them in `VITE_*` variables
- Keep IntelliJ credentials in Git-ignored local settings; do not overwrite user changes to `.run/Backend.run.xml` or track `.run` files
- Local Google callback: `http://localhost:8080/login/oauth2/code/google`
- `FRONTEND_URL` sets the fixed post-login origin, default `http://localhost:5173` (no trailing slash)
- `SecurityConfig` integrates Spring Security with the existing credentialed MVC CORS configuration
- Anonymous GET/HEAD browsing of authors, characters and quotes is allowed; published-content API writes require authentication and CSRF. Candidate staging writes temporarily require CSRF only.
- Every authenticated Google user can write; editor/admin roles are not implemented
- AuthController returns minimal DTOs from `/api/auth/me` and `/api/auth/csrf`, with `Cache-Control: no-store`
- `/api/auth/logout` is a CSRF-protected POST that invalidates the session and clears its cookie
- Frontend API calls include cookies and fetch a fresh session-bound CSRF token before writes
- Login failure redirects to the frontend with `?login=error`; no provider error details or tokens are exposed
- Session cookies are HttpOnly and SameSite=Lax; use localhost consistently for local development
- Production still requires HTTPS, secure cookies, trusted proxy headers, production OAuth credentials/callback, and nginx forwarding of `/oauth2/` and `/login/oauth2/` as well as `/api/`
- See README.md for setup, endpoint behavior, and deployment prerequisites

## Production Deployment Strategy

### Overview
Quote DB uses **GitHub Actions for CI/CD** with a self-hosted Ubuntu runner:

1. **Trigger**: Push to `main` branch only (PRs do not trigger deployment)
2. **Build**: GitHub Actions builds backend (Maven) and frontend (Node.js/npm)
3. **Deploy**: Copies compiled artifacts to production directories
4. **Restart**: Systemd services automatically restart with new code
5. **Verify**: Health checks confirm services are running

### Architecture
- **Backend**: Spring Boot JAR running on port 8080 via systemd service
- **Frontend**: Static React build served by nginx on port 80
- **Database**: MySQL 8.0 (auto-creates `quote_db` on first backend run)
- **Reverse Proxy**: nginx routes `/` to frontend, `/api/` to backend

### Deployment Flow

```
GitHub Push to main branch
    ↓
GitHub Actions Runner (self-hosted Ubuntu)
    ├─ Checkout code
    ├─ Set up Java 25 + Maven
    ├─ Set up Node.js 24 + npm
    ├─ mvn clean package (build backend JAR)
    ├─ npm ci && npm run build (build frontend)
    ├─ Copy JAR to /opt/quote-db/
    ├─ Copy frontend dist/ to /var/www/quote-db/
    ├─ sudo systemctl restart quote-db
    ├─ sudo systemctl reload nginx
    └─ Health checks (curl endpoints)

Note: PRs and pushes to other branches do NOT trigger deployment
```

### File Locations on Ubuntu

| Component | Location | Purpose |
|-----------|----------|---------|
| Backend JAR | `/opt/quote-db/quote-db-1.0-SNAPSHOT.jar` | Runnable application |
| Frontend Static | `/var/www/quote-db/` | HTML/CSS/JS for browser |
| systemd Service | `/etc/systemd/system/quote-db.service` | Auto-start backend on reboot |
| nginx Config | `/etc/nginx/sites-available/quote-db` | Reverse proxy rules |
| MySQL Data | `/var/lib/mysql/` | Database files |

### Health Checks

Workflow verifies deployment success:
```bash
curl -f http://localhost:8080/swagger-ui.html    # Backend API docs
curl -f http://localhost/                         # Frontend (if nginx)
```

### Restart Behavior

**Backend Service** (`/etc/systemd/system/quote-db.service`):
- Restarts automatically on failure
- Logs available via: `sudo journalctl -u quote-db -n 50`

**Frontend** (nginx):
- Graceful reload: `sudo systemctl reload nginx`
- No downtime during refresh

**Manual Restart** (if needed):
```bash
sudo systemctl restart quote-db
sudo systemctl reload nginx
```

### Database Persistence

- MySQL `quote_db` database persists across deployments
- Flyway applies versioned MySQL migrations from `src/main/resources/db/migration`
- Hibernate `ddl-auto=validate` checks entity/schema compatibility; use new migrations for schema changes
- Existing unversioned databases must match V1 before a one-time Flyway baseline; see README.md
- Quote search uses optional `query` on GET `/api/quotes`, MySQL natural-language FULLTEXT on text only, and relevance ordering
- Snowball English (Porter2), supplied by lucene-analysis-common, normalizes quotes and queries via `QuoteSearchText.normalize`: StandardTokenizer -> LowerCaseFilter -> SnowballFilter(EnglishStemmer)
- Queries use `QuoteSearchText.normalizeQuery` to retain double-quote phrase boundaries while stemming words; MySQL natural-language mode supports phrases, not AND/OR operators
- Phrase matching uses normalized word order, not exact punctuation/original spelling; keep quoted/unquoted Shakespeare regression tests
- `quotes.search_text` is a derived internal TEXT column, indexed by `ft_quotes_search_text`; never expose it in DTOs or accept it from clients
- Quote `@PrePersist`/`@PreUpdate` callbacks maintain search text for every JPA save; direct SQL/bulk JPQL bypass them and must use the same normalizer
- Flyway V3 adds search text, Java V4 backfills in 500-row keyset batches, V5 makes it required and replaces the raw-text index; keep applied migrations unchanged
- Stop old writers before the V2-to-V5 upgrade; existing data is preserved with no reset or baseline needed
- Snowball matches move/moving, walk/walking, study/studied and other inflections/derivations; stems may not be words and irregulars such as child/children remain distinct
- Analyzer/dependency changes after deployment require a new derived-text backfill migration; the undeployed V3-V5 migrations install Snowball directly
- MySQL search/migration tests require `MYSQL_TEST_URL`, `MYSQL_TEST_USERNAME`, and `MYSQL_TEST_PASSWORD`; H2 tests disable Flyway
- Seed data must be loaded separately (see `seed-data.sh`)

### Rollback Strategy

If a deployment fails:
1. GitHub Actions shows failure with error logs
2. Previous JAR remains in `/opt/quote-db/` (optional: keep backup)
3. Manual rollback: Stop service, restore previous JAR, restart
4. Frontend: Previous `dist/` can be kept as backup (nginx serves latest)
