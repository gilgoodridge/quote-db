# Ubuntu 26.04 Deployment Setup

This guide covers installing everything needed to run the Quote DB backend and frontend on Ubuntu 26.04, including the GitHub Actions runner for CI/CD.

## Prerequisites

- Ubuntu 26.04 LTS instance with SSH access
- `sudo` privileges
- At least 10 GB free disk space
- Internet connectivity

## Installation Steps

### 1. Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl gnupg lsb-release git libicu-dev

# Install locales (required for GitHub Actions runner on minimized Ubuntu)
sudo apt install -y locales
sudo locale-gen en_US.UTF-8
sudo update-locale LANG=en_US.UTF-8
```

**Note**: `libicu-dev` is required for the .NET-based GitHub Actions runner on minimized Ubuntu images. Without it, the runner crashes with CultureInfo errors.

### 2. Install Java 25

Quote DB requires **Java 25** (not Java 27 due to Spring Boot compatibility).

```bash
# Add Eclipse Temurin repository (modern Ubuntu 26.04 method)
curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | sudo tee /etc/apt/trusted.gpg.d/adoptium.asc > /dev/null

# Add repository
echo "deb [signed-by=/etc/apt/trusted.gpg.d/adoptium.asc] https://packages.adoptium.net/artifactory/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/adoptium.list

# Install Java 25
sudo apt update
sudo apt install -y temurin-25-jdk

# Verify installation
java -version
```

### 3. Install Maven 3.9+

```bash
# Install Maven
sudo apt install -y maven

# Verify installation
mvn -version
```

### 4. Install Node.js 24 LTS and npm 11+

```bash
# Using NodeSource repository for Node.js 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node --version  # Should be v24.x.x
npm --version   # Should be 11.x.x or higher

# If npm is older, upgrade it
sudo npm install -g npm@latest
```

### 5. Install GitHub Actions Runner

#### 6a. Create a directory for the runner

```bash
mkdir -p ~/github-runner
cd ~/github-runner
```

#### 6b. Download and extract the runner

Go to your GitHub repository → **Settings → Actions → Runners → New self-hosted runner**

Follow GitHub's instructions, which will look like:

```bash
# Download
curl -o actions-runner-linux-x64-2.319.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.319.1.tar.gz

# Configure (replace TOKEN with GitHub's provided token and YOUR_REPO_NAME)
./config.sh --url https://github.com/YOUR_USERNAME/quote-db --token TOKEN

# Install as service (optional but recommended for auto-start)
sudo ./svc.sh install
sudo systemctl enable actions.runner.YOUR_USERNAME-quote-db.RUNNER_NAME.service
sudo ./svc.sh start
```

#### 6c. Verify runner is connected

In GitHub: **Settings → Actions → Runners**, the runner should show as "Idle" (green).

### 6. Add a Swap File

The instance has ~1 GB RAM and no swap. Add 2 GB so builds and the JVM don't trigger OOM kills:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -p /etc/sysctl.d/99-swappiness.conf

# Verify
free -h
```

### 7. Set Up Application Directories and Permissions

```bash
# Create deployment directories
sudo mkdir -p /opt/quote-db
sudo mkdir -p /var/www/quote-db

# Set permissions (adjust username as needed)
sudo chown $USER:$USER /opt/quote-db
sudo chown $USER:$USER /var/www/quote-db
```

### 8. Configure Backend Environment

Point the backend at the OCI-hosted MySQL (the database server is not installed on this instance; the backend creates `quote_db` on first run). Create `/opt/quote-db/application.properties` (before starting the service in step 9):

```properties
# Server Port (default 8080)
server.port=8080

# MySQL Connection (OCI-hosted MySQL; use its private endpoint)
spring.datasource.url=jdbc:mysql://<oci-mysql-host>:3306/quote_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# Hibernate Configuration
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
```

### 9. Create systemd Service for Backend

Create `/etc/systemd/system/quote-db.service`:

```bash
sudo tee /etc/systemd/system/quote-db.service > /dev/null <<EOF
[Unit]
Description=Quote DB Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/quote-db
ExecStart=/usr/bin/java -Xmx256m -Xss512k -XX:+UseSerialGC -jar /opt/quote-db/quote-db-1.0-SNAPSHOT.jar
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable quote-db
sudo systemctl start quote-db

# Check status
sudo systemctl status quote-db
```

**Note**: Replace `$USER` with your actual username if running as a different user. The JVM flags cap heap at 256 MB and use the serial GC to fit the ~1 GB instance; raise `-Xmx` if the app gets OOM errors.

If the service already exists, edit the `ExecStart` line in `/etc/systemd/system/quote-db.service`, then `sudo systemctl daemon-reload && sudo systemctl restart quote-db`.

### 10. Allow the Deploy Workflow to Restart Services (sudoers)

The workflow runs `sudo systemctl restart quote-db` and `sudo systemctl reload nginx` non-interactively. Grant the runner user (`ubuntu` here; use your runner's username) passwordless access to exactly those commands:

```bash
sudo tee /etc/sudoers.d/quote-db-deploy > /dev/null <<EOF
ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart quote-db, /usr/bin/systemctl reload nginx
EOF
sudo chmod 440 /etc/sudoers.d/quote-db-deploy
sudo visudo -cf /etc/sudoers.d/quote-db-deploy

# Verify (must not prompt for a password; the nginx check works once step 12 is done)
sudo -n systemctl restart quote-db && echo OK
sudo -n systemctl reload nginx && echo OK
```

Confirm the systemctl path with `command -v systemctl` and adjust the file if it differs. Restart the runner service afterward if the workflow still prompts.

The workflow's `|| echo` fallbacks hide a missing sudoers entry, so a deploy can look green without restarting anything. Do this step before relying on deploys.

### 11. Open Ports 80 and 443 on the Instance Firewall (OCI)

OCI Ubuntu images ship with iptables rules that accept only SSH (22) and reject everything else. Also open TCP 80 and 443 ingress in the OCI VCN Security List (or NSG). That alone is not enough; the instance firewall must also allow them. Port 8080 stays closed to the public; nginx proxies to the backend on localhost.

Check the current INPUT chain:

```bash
sudo iptables -L INPUT -n --line-numbers
```

Insert ACCEPT rules at the top of the chain (above the final `REJECT`):

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -L INPUT -n --line-numbers
```

Persist the rules across reboots:

```bash
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 12. Set Up nginx as Reverse Proxy

nginx serves the frontend on ports 80/443 and proxies API calls to the backend.

```bash
# Install nginx
sudo apt install -y nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/quote-db > /dev/null <<EOF
server {
    listen 80;
    server_name www.gilgood.com;

    # Serve frontend static files
    location / {
        root /var/www/quote-db;
        try_files \$uri /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Swagger UI
    location /swagger-ui {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
    }

    location /v3/ {
        proxy_pass http://localhost:8080/v3/;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/quote-db /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx
```

### 13. Enable HTTPS with Let's Encrypt (www.gilgood.com)

**DNS** (Squarespace Domains): an A record with host www pointing to the reserved public IP 132.226.92.246. Verify before continuing:

```bash
dig +short www.gilgood.com   # must print 132.226.92.246
```

Ports 80 and 443 must be open in both the OCI Security List and iptables (see step 11). Then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.gilgood.com --redirect -m <your-email> --agree-tos

# Confirm automatic renewal works
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Certbot edits the nginx site to add the 443 listener and the HTTP-to-HTTPS redirect. Renewal runs from a systemd timer and reloads nginx automatically; no deploy changes are needed. Only www is served; the apex gilgood.com is not covered by the certificate.

## Verification

### Check all services are running:

```bash
# Backend service
sudo systemctl status quote-db

# nginx
sudo systemctl status nginx
```

### Test the deployment:

```bash
# Test backend API
curl http://localhost:8080/swagger-ui.html

# Test frontend through nginx
curl -I http://localhost

# Test API endpoint
curl http://localhost:8080/api/authors

# Test over TLS from anywhere (after step 13)
curl -I https://www.gilgood.com/
curl https://www.gilgood.com/api/authors
```

Swagger UI: `https://www.gilgood.com/swagger-ui/index.html`.

## Troubleshooting

### Public URL times out but `curl localhost` works
- Usually the instance firewall. Check `sudo iptables -L INPUT -n --line-numbers` for a `REJECT` rule with no 80/443 `ACCEPT` above it. See step 11.
- Confirm the VCN Security List allows TCP 80 and 443 ingress for the instance's subnet.

### Maven build fails with "No suitable Java version"
- Verify Java 25 is installed: `java -version`
- Check `$JAVA_HOME`: `echo $JAVA_HOME`
- If not set: `export JAVA_HOME=/usr/lib/jvm/temurin-25-jdk-amd64`

### Runner not connecting to GitHub
- Verify token hasn't expired: Check GitHub → Settings → Actions → Runners
- Restart runner: `sudo systemctl restart actions.runner.YOUR_USERNAME-quote-db.service`
- Check runner logs: `~/github-runner/_diag/` directory

### Backend won't start (port 8080 already in use)
- Find process: `sudo lsof -i :8080`
- Kill it: `sudo kill -9 <PID>`
- Or change port in `/opt/quote-db/application.properties`

### Backend can't connect to MySQL / "Access denied"
- The database is OCI-hosted MySQL and is not installed on this instance. Check the host, username and password in `/opt/quote-db/application.properties`.
- Confirm the MySQL subnet's Security List or NSG allows TCP 3306 from this instance.
- The MySQL client is only needed for troubleshooting (not required to run the app):
  ```bash
  sudo apt install -y mysql-client
  mysql -h <oci-mysql-host> -u <user> -p
  ```

### nginx returns 502 Bad Gateway
- Verify backend is running: `sudo systemctl status quote-db`
- Check backend logs: `sudo journalctl -u quote-db -n 50`
- Verify backend is listening on 8080: `sudo lsof -i :8080`

## Next Steps

1. **Commit and push** the `.github/workflows/build-deploy.yml` file
2. **SSH into your Ubuntu instance** and follow installation steps 1-13 in order
3. **Push to main branch** to trigger the first GitHub Actions workflow (only pushes to main trigger deployment)
4. **Monitor the workflow** in GitHub: **Actions → Build & Deploy**
5. **Check deployment** by accessing:
   - Site: `https://www.gilgood.com`
   - API: `https://www.gilgood.com/api/authors`

## Performance Notes

- **First build** takes ~3-5 minutes (Maven dependency download, Node.js modules)
- **Subsequent builds** are much faster (~1-2 minutes) due to caching
- **Deployment**: the new JAR and frontend files are copied, then the backend restarts and nginx reloads
- **Memory**: the instance has ~1 GB RAM; the swap file (step 6) and the JVM `-Xmx256m` cap (step 9) keep builds and the backend from being OOM-killed

---

*Last updated: 2026-10-13*
