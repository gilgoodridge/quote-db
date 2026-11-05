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

#### Authors
- `GET /api/authors` - List all authors
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

#### Quotes
- `GET /api/quotes?authorId={id}&query={text}&toneIds={id}&themeIds={id}&formIds={id}&sourceIds={id}` - List quotes, optionally filtered by author/categories and searched by text
- `POST /api/quotes` - Create a quote with `text`, `authorId`, and optional
  `date` (`YYYY-MM-DD`), `location`, `reference`, `toneIds`, `themeIds`, `formIds`, and `sourceIds`
- `GET /api/quotes/{id}` - Get a quote
- `PUT /api/quotes/{id}` - Replace a quote
- `DELETE /api/quotes/{id}` - Delete a quote

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
the precise `location` (page, scene, venue, etc.) or the `reference` URL.
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

The **Add Quote / Edit Quote** dialog loads these catalogs and provides checkbox
groups for all four dimensions, with selection counts and a **Clear** action
per group. No selection is required. Editing prefills existing selections;
saving includes all four ID arrays, so changing text or other metadata does not
clear categories unintentionally. Unchecking options or clearing a group removes
those selections on save.

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
  behavior (including `authorId` filtering and existing unsorted order).
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
If an author is selected, only that author's quotes are searched; otherwise,
all quotes are searched and each result displays its author. Changing or
deselecting the author reruns the submitted search in the new scope.
Editing nonblank text does not search until submission; clearing the box
immediately returns to normal author browsing (or the author-selection prompt).
Submitting again also retries a failed search. Loading, failures, and no matches
are displayed separately, and results retain the backend's relevance ordering.

### Adding a quote in the UI

**Add Quote** is always visible in the right side of the header. **Quote of the
Day** sits beside the Quotes DB logo on the left. Anonymous users are prompted
to sign in with Google before adding a quote; after sign-in, the form opens
automatically. A tab-scoped session-storage flag preserves only this intent
across the redirect, not credentials or quote data. Browser session storage must
be available to resume the action automatically.

The form includes all POST fields: quote text (up to 2,048 characters), an
existing author selected from a dropdown, date, location, and reference (the
latter two up to 255 characters each), and optional multi-select Tone, Theme,
Form, and Source groups. The currently selected author is
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
including the author and category selections. Saving sends a full replacement: clearing an optional
field removes its value. Results refresh in the current author/search scope,
so a changed quote may no longer match. Cancel leaves the quote unchanged;
save failures keep the draft open.

Delete requires browser confirmation before sending the request. Failures are
shown without removing the card. Deleting a quote never deletes its author,
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
Hibernate uses `spring.jpa.hibernate.ddl-auto=validate`,
not `update`. Add new migrations for future schema changes; do not edit migrations
that have already run. The database account needs schema DDL privileges in addition
to normal data access. Migration failures stop startup rather than allowing search
to run without its index.

**Upgrade an existing Flyway V2 database (including production):** Back up and
stop all old backend instances/writers before starting the new JAR. Flyway
applies V3-V7 automatically, preserving IDs, original text, authors, and all
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
recreating tables, then applies V2-V7 while preserving data. Remove this override
after successful startup; by default Flyway refuses unversioned nonempty databases
to avoid silently adopting the wrong database. Do not manually pre-create the index.
Index creation can take time and require table locks; schedule deployment accordingly.
Update any server-local `application.properties` override from `ddl-auto=update`
to `validate` as well.

**MySQL integration tests:** Normal `mvn test` covers HTTP compatibility using mocks,
category API/persistence with H2, and the V6/V7 catalogs, descriptions, and constraints in H2 MySQL mode.
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

Browsing authors and quotes is public. Creating, updating, or deleting either
resource now requires a Google-authenticated session and a valid CSRF token.
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
seed/import scripts cannot write without authentication.

`seed-data.sh` prompts for the `JSESSIONID` cookie value from a signed-in session
for the selected base URL, fetches its CSRF token, and includes both on seed
requests. Sign into the site first and copy the cookie value from browser
developer tools; do not save or share it. The session ID is sensitive and
expires when the session ends.

The seed script also requires **jq** (`sudo apt install jq` on Ubuntu or
`scoop install jq` on Windows with Scoop). After V6 is deployed, the catalogs
already exist: the script reads `/api/categories` and resolves labels to IDs
instead of inserting duplicate catalog entries or assuming fixed IDs.
It creates 7 authors and 20 quotes with sample tone, theme, form, and known
source selections, including multiple selections in each dimension. Sources
not identified by the existing seed metadata are left unassigned rather than
invented. In `create_quote`, arguments 6-9 are optional tone, theme, form, and
source labels; separate multiple labels with `|`. Omitting them sends empty
arrays. Missing/duplicate catalog labels or failed requests stop the script;
earlier writes are not rolled back. It is not an idempotent import.

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
