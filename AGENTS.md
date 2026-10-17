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
- Required fields (e.g., `givenName`, `familyName`) must be provided; missing = 400 Bad Request
- Clean, predictable semantics: no "empty string vs null" ambiguity
- Clients must fetch full resource before updating if partial changes needed

**Example:**

PUT /api/authors/1

// Replace entire author; preferredName and bio are deleted

```json
{
  "givenName": "Jane",
  "familyName": "Doe",
  "dateOfBirth": "1950-05-15",
  "nationality": "US"
}
```

### Endpoints
- `GET /api/authors` - Returns `List<AuthorResponse>`
- `POST /api/authors` - Accepts `CreateAuthorRequest`, returns `AuthorResponse`
- `PUT /api/authors/{id}` - Accepts `UpdateAuthorRequest` (full replacement), returns `AuthorResponse`
- `DELETE /api/authors/{id}` - Deletes author

### Implementation Pattern
```java
@GetMapping
public List<AuthorResponse> list() {
    return repository.findAll()
        .stream()
        .map(mapper::toResponse)  // Entity → DTO
        .collect(Collectors.toList());
}
```

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
│   ├── index.css                 # Global styles & theme variables
│   ├── components/
│   │   ├── Header.jsx            # Top header with logo, search, menu
│   │   ├── LoginDialog.jsx       # Optional Google OIDC login dialog
│   │   ├── Sidebar.jsx           # Left sidebar: author filter list
│   │   ├── QuotesList.jsx        # Center content: quotes display
│   │   └── Placeholder.jsx       # Right sidebar: future feature placeholder
│   └── styles/
│       ├── Header.css            # Header styling
│       ├── LoginDialog.css       # Login modal and Google button styling
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
- Center: Full-width search bar for quotes (currently disabled, ready for backend integration)
- Right: "Quote of the Day" button + hamburger menu (Login above About)
- Neutral color scheme with subtle borders

**Main Content (Below Header)**
- **Left Sidebar (25% width)**: Author filter panel
  - Displays list of authors fetched from backend
  - Click author to select/deselect and filter quotes
  - Active author highlighted with accent color
  - Scrollable if many authors

- **Center Content (50% width)**: Quote display area
  - Empty state with icon when no author selected ("Select an author from left panel")
  - Shows placeholder text when author selected (ready for backend quote list integration)
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
- Search input disabled until backend search is ready
- Quote of the Day button placeholder

**LoginDialog.jsx**
- Native modal dialog with "Continue with Google" and "Keep browsing" actions
- Login is optional; anonymous browsing remains available
- Google button navigates to the backend `/oauth2/authorization/google` endpoint
- Spring Security handles OIDC and stores authentication in the server session, not browser storage
- Do not display a "coming soon" message for Google sign-in
- Native dialog provides modal keyboard focus and Escape dismissal
- Uses theme variables for light/dark mode, with fixed Google brand colors defined in index.css

**Sidebar.jsx**
- Fetches authors from `GET /api/authors` on mount
- Shows loading/error states
- Button-based author selection with active state styling
- Ready for backend quote filtering

**QuotesList.jsx**
- Shows empty state until author is selected
- Placeholder text when author selected (ready for backend quote list)
- Scrollable container for future quote display

**Placeholder.jsx**
- Decorative component for right sidebar
- Animated graphic with gradient background
- Placeholder for ads, recommendations, or other future features

---

## Running Frontend & Backend Together

### Development Mode (with hot reload)

**IntelliJ IDEA**
- Shared configurations live in `.run`, outside the ignored `.idea` directory
- **Frontend** runs `npm run dev` using the project Node.js interpreter
- **Backend** runs `org.gilgood.Application` in module `quote-db` using the existing `ms-25` Java 25 SDK
- **Full Stack** launches Backend and Frontend together
- The existing local **Application** configuration is unchanged
- Requires IntelliJ's JavaScript and TypeScript and Node.js plugins, installed frontend dependencies (`npm ci`), and running MySQL
- Stop existing server instances before launching to avoid port conflicts
- See README.md for interpreter configuration and startup details

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
- Keep IntelliJ credentials local; do not overwrite user changes to `.run/Backend.run.xml`
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
- Hibernate `ddl-auto=update` automatically migrates schema
- Seed data must be loaded separately (see `seed-data.sh`)

### Rollback Strategy

If a deployment fails:
1. GitHub Actions shows failure with error logs
2. Previous JAR remains in `/opt/quote-db/` (optional: keep backup)
3. Manual rollback: Stop service, restore previous JAR, restart
4. Frontend: Previous `dist/` can be kept as backup (nginx serves latest)
