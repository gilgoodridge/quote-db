# Quick Start: GitHub Actions Deployment

## What Was Created

✅ **`.github/workflows/build-deploy.yml`** - GitHub Actions workflow that:
- Triggers on push to `main` branch only (production deployment)
- Pull requests do not trigger deployment
- Builds backend (Maven) → JAR to `/opt/quote-db/`
- Builds frontend (React) → static files to `/var/www/quote-db/`
- Restarts backend service and reloads nginx
- Runs health checks to verify deployment

✅ **`UBUNTU-SETUP.md`** - Complete Ubuntu 26.04 setup guide covering:
- Java 25, Maven, Node.js 24, npm 11, MySQL 8.0
- GitHub Actions self-hosted runner installation
- systemd service for backend auto-start
- nginx reverse proxy configuration
- Troubleshooting and verification steps

✅ **Updated `AGENTS.md`** - Deployment strategy documentation (no installation steps)

✅ **Updated `README.md`** - Links to setup guide and deployment overview

---

## Next Steps (On Your Ubuntu Instance)

### Phase 1: Initial Setup (One-time, ~15 minutes)

```bash
# 1. SSH into your Ubuntu instance
ssh user@your-ubuntu-ip

# 2. Follow UBUNTU-SETUP.md step-by-step:
#    - Steps 1-5: System packages, Java, Maven, Node.js, MySQL
#    - Step 6: GitHub Actions runner (get token from repo Settings)
#    - Step 7-10: Application directories, services, nginx (optional)
```

**Key commands:**
- Java 25: `sudo apt install temurin-25-jdk`
- Node.js 24: `curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install nodejs`
- GitHub Runner: Follow GitHub UI prompts in repo Settings → Actions → Runners

### Phase 2: Trigger First Deployment (After runner is ready)

```bash
# 1. Commit workflow to GitHub (push to main branch)
git add .github/workflows/build-deploy.yml
git commit -m "Add GitHub Actions CI/CD workflow"
git push origin main

# 2. Go to GitHub → Actions tab
#    Watch the "Build & Deploy" workflow run (only main branch triggers it)

# 3. Verify deployment (from your local machine)
curl http://your-ubuntu-ip:8080/swagger-ui.html    # Backend API docs
curl http://your-ubuntu-ip/api/authors              # Backend API
```

---

## File Locations on Ubuntu (After Deployment)

| Component | Path | Notes |
|-----------|------|-------|
| Backend JAR | `/opt/quote-db/quote-db-1.0-SNAPSHOT.jar` | Deployed by workflow |
| Frontend | `/var/www/quote-db/` | Static React build |
| Service | `/etc/systemd/system/quote-db.service` | Auto-start on reboot |
| nginx Config | `/etc/nginx/sites-available/quote-db` | Reverse proxy |
| MySQL | `/var/lib/mysql/quote_db` | Auto-created on first run |

---

## Troubleshooting First Deployment

### Runner doesn't appear in GitHub
- Check token hasn't expired: `~/github-runner/config.sh` should show "Connected"
- Restart runner: `sudo systemctl restart actions.runner.YOUR_USERNAME-quote-db.service`

### Workflow fails on Java/Maven/Node setup
- Runner might be using old action versions; GitHub's `setup-java@v4` and `setup-node@v4` auto-install correct versions
- If persistent: SSH into runner and manually verify: `java -version`, `mvn -version`, `node -version`

### Backend won't start after deployment
- Check systemd service exists: `sudo systemctl status quote-db`
- If not created, run Step 8 from UBUNTU-SETUP.md
- View logs: `sudo journalctl -u quote-db -n 50`

### Port 8080 already in use
- Find process: `sudo lsof -i :8080`
- Or change server port in `/opt/quote-db/application.properties` (see UBUNTU-SETUP.md Step 10)

### nginx returns 502 Bad Gateway
- Verify backend is running: `curl http://localhost:8080/swagger-ui.html`
- Check nginx config: `sudo nginx -t`
- Restart nginx: `sudo systemctl restart nginx`

---

## Monitoring Deployments

### On GitHub
**Repository → Actions → Build & Deploy**
- View real-time logs
- See build status (✅ success or ❌ failed)
- Re-run workflow if needed

### On Ubuntu
```bash
# Check services
sudo systemctl status quote-db
sudo systemctl status nginx
sudo systemctl status mysql

# View backend logs
sudo journalctl -u quote-db -n 50 -f  # Follow (-f) for live tail

# View nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Quick health check
curl http://localhost:8080/api/authors
```

---

## Notes

- **First build** takes ~3-5 minutes (Maven dependencies download)
- **Subsequent builds** ~1-2 minutes (cached)
- **Zero-downtime deployments**: Old JAR runs while new one downloads, then service restarts
- **Database persists** across deployments: `quote_db` created by Hibernate on first run
- **Free GitHub Actions**: Self-hosted runners don't count against your GitHub Actions minutes

---

Questions? Check `UBUNTU-SETUP.md` for detailed step-by-step instructions, or refer to `AGENTS.md` for deployment architecture.
