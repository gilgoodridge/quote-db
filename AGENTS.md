# Architecture & Learnings

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
- `GET /api/authors` - Returns `PagedModel<AuthorResponse>`; optional `query` searches fullName only
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
        ? repository.findByFullNameContainingIgnoreCase(query.trim(), pageable)
        : repository.findAll(pageable);
    return new PagedModel<>(authors.map(mapper::toResponse));
}
```

Author and quote lists use zero-based `page` (default 0) and `size` (default 20,
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
- Use `AuthorRepository.findByFullNameContainingIgnoreCase` for case-insensitive
  substring matching on fullName only, with database pagination/counting and ID
  ascending order. Spring Data escapes LIKE wildcards; treat `%`, `_`, and `\`
  literally. Do not search knownAs or reuse quote FULLTEXT stemming/relevance.
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
  when hidden) or changes quote text/category filters. All authors still clears
  only the selected author. Labels continue to prefer knownAs over fullName.
- Keep the field compact above the list, keyboard accessible, and theme-aware.
  Show loading, no matches, and visible retryable errors separately; clear stale
  results on first-page reload, retain results on more-page failure, and ignore outdated requests.
- AuthorControllerTest and AuthorRepositoryTest cover query/blank handling,
  pagination, fullName-only matching, case-insensitive substrings, and literal
  wildcards. API and Sidebar tests cover encoding, all-pages query retention,
  submission/clearing, retry, refresh, filter independence, and stale responses.

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
  actions. Options/IDs come from the API, never hardcoded frontend catalogs.
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
- Left navigation provides author selection and optional category checkboxes.
  Bound the author-list height so it cannot consume the navigation; category
  selections combine across dimensions and with author/text filters using AND.
  Category catalog failures must remain visible and retryable.
- `npm test` in frontend runs existing Node API tests and Vitest/jsdom category,
  author-heading, and author-dialog interaction tests. Keep the Vitest include scoped to `*.test.jsx`
  so Node's `api.test.js` is not executed by both runners.
- `seed-data.sh` requires jq and loads `/api/categories` to resolve labels rather
  than hardcoding IDs. Optional arguments 6-9 to `create_quote` accept tone,
  theme, form, and source labels separated by `|`; samples include multi-select
  categories. Do not invent unknown source types.
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
│   │   ├── Sidebar.jsx           # Left sidebar: author filter list
│   │   ├── QuotesList.jsx        # Center content: quotes display
│   │   └── Placeholder.jsx       # Right sidebar: future feature placeholder
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
- **Left Sidebar (25% width)**: Author filter panel
  - Displays list of authors fetched from backend
  - Click author to select/deselect and filter quotes
  - Active author highlighted with accent color
  - Scrollable if many authors

- **Center Content (50% width)**: Quote display area
  - Selection prompt when no author, search query, or category filter is active
  - Selected author's display name appears once above their quotes, even during loading, failure, or no matches
  - Mixed-author results show names beneath each quote instead of an author heading
  - Both author-name placements open the About this Author dialog
  - Scrollable for long quote lists

- **Right Sidebar (25% width)**: Reserved for future features
  - Placeholder graphic with floating animation
  - "Coming Soon" text (could be ads, recommendations, etc.)

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
- Fetches authors from `GET /api/authors` on mount and on submitted author query/refresh
- Compact fullName search submits optional `query` with Enter/search icon or after a 500 ms typing pause; clearing restores the first unfiltered page
- Loads 10 authors initially with More authors to append further pages; searches and refreshes reset to page 0
- Shows loading/no-match/retryable error states and ignores outdated author responses
- Button-based author selection with active state styling
- Author list search preserves author selection and quote text/category filters

**QuotesList.jsx**
- Shows a selection prompt when no author, search query, or category filter is active
- Searches all quotes when a query is submitted without an author; otherwise scopes to the selected author
- Uses knownAs when present, otherwise fullName; shows the selected author once as a heading, or per-quote names in mixed-author results
- Heading loads independently via `api.authors.get(id)`, with visible, retryable failures
- Both heading and per-quote names are keyboard-accessible buttons opening AboutAuthorDialog without changing filters or expanding a quote
- Author updates refresh the heading, matching quote authors/results, and Authors sidebar while preserving filters
- Preserves backend relevance order
- Shows distinct loading, error, and no-match states; ignores outdated requests after filter changes
- Scrollable quote display with expandable details

**AboutAuthorDialog.jsx / AddAuthorDialog.jsx**
- About this Author is a public, read-only native modal that fetches full details through `api.authors.get(id)`; loading failures are visible and retryable
- Shows full name, known-as name, birth/death dates, birthplace, nationality, biography, and age when available; missing fields display "Not provided"
- Render date-only author values without timezone shifts and preserve biography line breaks
- Only authenticated users see the top-right pencil, which opens AddAuthorDialog prefilled for editing
- Share field definitions through `authorFields.js`; AddAuthorDialog supports both existing creation and full-replacement PUT updates
- Submit all editable fields, trim text, and send cleared optional fields as null; full name and birth date remain required
- Preserve drafts on failed saves, including conflicts and expired sessions; prevent duplicate submissions and dismissal while saving
- Cancel returns to unchanged details; successful saves update the details and notify QuotesList/App to refresh other author surfaces
- Use native modal keyboard behavior; restore focus to the pencil after editing and to the invoking name after closing About (or the quotes container if that name was removed)
- Use theme variables and wrapping/scrolling for narrow screens; never expose editing controls to anonymous users

**Placeholder.jsx**
- Decorative component for right sidebar
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
- Anonymous GET/HEAD browsing of authors and quotes is allowed; all API writes require authentication and CSRF
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
