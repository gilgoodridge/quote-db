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
2. MySQL will auto-create `quote_db` database on first run (configured in `application.properties`)
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

### Available Endpoints

#### Authors
- `GET /api/authors` - List all authors
- `POST /api/authors` - Create author
  ```json
  {
    "givenName": "John",
    "familyName": "Doe"
  }
  ```
- `PUT /api/authors/{id}` - **Full replacement** (all optional fields omitted are cleared)
  ```json
  {
    "givenName": "Jane",
    "familyName": "Doe",
    "dateOfBirth": "1950-05-15",
    "nationality": "US"
  }
  ```
- `DELETE /api/authors/{id}` - Delete author

*More endpoints coming: quotes, sources, topics, analytics queries*

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

Shared run configurations are stored in `.run` and appear in the run configuration
dropdown:
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
- `spring.jpa.hibernate.ddl-auto=update` (auto-creates/updates schema)
- For production, consider Liquibase or Flyway

### Google login

Browsing authors and quotes is public. Creating, updating, or deleting either
resource now requires a Google-authenticated session and a valid CSRF token.
Any signed-in Google user can write; there are no editor/admin roles yet.

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend environment
(IntelliJ: **Run > Edit Configurations > Backend > Environment variables**).
Keep credentials local, not in shared `.run` files or `VITE_*` variables.
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
- **Full-text Search**: Elasticsearch for quote content search
- **Analytics Endpoints**: Aggregations and reporting queries

## License

[Specify license]
