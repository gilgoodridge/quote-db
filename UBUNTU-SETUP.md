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

### 5. Install MySQL 8.0

```bash
sudo apt install -y mysql-server

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure MySQL (optional but recommended)
sudo mysql_secure_installation

# Verify MySQL is running
sudo systemctl status mysql
```

**Note**: The backend automatically creates the `quote_db` database on first run. Ensure MySQL is running before deploying.

### 6. Install GitHub Actions Runner

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

### 7. Set Up Application Directories and Permissions

```bash
# Create deployment directories
sudo mkdir -p /opt/quote-db
sudo mkdir -p /var/www/quote-db

# Set permissions (adjust username as needed)
sudo chown $USER:$USER /opt/quote-db
sudo chown $USER:$USER /var/www/quote-db
```

### 8. Create systemd Service for Backend (Optional but Recommended)

Create `/etc/systemd/system/quote-db.service`:

```bash
sudo tee /etc/systemd/system/quote-db.service > /dev/null <<EOF
[Unit]
Description=Quote DB Backend
After=network.target mysql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/quote-db
ExecStart=/usr/bin/java -jar /opt/quote-db/quote-db-1.0-SNAPSHOT.jar
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

**Note**: Replace `$USER` with your actual username if running as a different user.

### 9. Set Up nginx as Reverse Proxy (Optional)

If you want to serve frontend on port 80 and proxy API calls to the backend:

```bash
# Install nginx
sudo apt install -y nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/quote-db > /dev/null <<EOF
server {
    listen 80;
    server_name _;

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
    location /swagger-ui.html {
        proxy_pass http://localhost:8080/swagger-ui.html;
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

### 10. Configure Backend Environment (Optional)

If you need to customize database connection or server port, create `/opt/quote-db/application.properties`:

```properties
# Server Port (default 8080)
server.port=8080

# MySQL Connection
spring.datasource.url=jdbc:mysql://localhost:3306/quote_db?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# Hibernate Configuration
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
```

## Verification

### Check all services are running:

```bash
# Backend service
sudo systemctl status quote-db

# MySQL
sudo systemctl status mysql

# nginx (if installed)
sudo systemctl status nginx
```

### Test the deployment:

```bash
# Test backend API
curl http://localhost:8080/swagger-ui.html

# Test frontend (if nginx configured)
curl http://localhost

# Test API endpoint
curl http://localhost:8080/api/authors
```

### Open port 8080 on the instance firewall (OCI)

OCI Ubuntu images ship with iptables rules that accept only SSH (22) and reject everything else. Opening 8080 in the VCN Security List is not enough; the instance firewall must also allow it.

Check the current INPUT chain:

```bash
sudo iptables -L INPUT -n --line-numbers
```

Insert an ACCEPT rule for 8080 **above** the final `REJECT` line (position 5 in the example below; adjust to match your chain):

```bash
sudo iptables -I INPUT 5 -p tcp --dport 8080 -m state --state NEW -j ACCEPT
sudo iptables -L INPUT -n --line-numbers
```

Persist the rule across reboots:

```bash
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

**Note**: Port 8080 is exposed without TLS. To limit access, add `-s <your-ip>/32` to the rule.

## Troubleshooting

### Public URL times out but `curl localhost:8080` works
- Usually the instance firewall. Check `sudo iptables -L INPUT -n --line-numbers` for a `REJECT` rule with no 8080 `ACCEPT` above it. See "Open port 8080 on the instance firewall" above.
- Confirm the VCN Security List allows TCP 8080 ingress for the instance's subnet.

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

### MySQL "Access denied"
- Reset MySQL root password:
  ```bash
  sudo mysql
  ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
  FLUSH PRIVILEGES;
  ```

### nginx returns 502 Bad Gateway
- Verify backend is running: `sudo systemctl status quote-db`
- Check backend logs: `sudo journalctl -u quote-db -n 50`
- Verify backend is listening on 8080: `sudo lsof -i :8080`

## Next Steps

1. **Commit and push** the `.github/workflows/build-deploy.yml` file
2. **SSH into your Ubuntu instance** and follow installation steps 1-6
3. **Push to main branch** to trigger the first GitHub Actions workflow (only pushes to main trigger deployment)
4. **Monitor the workflow** in GitHub: **Actions → Build & Deploy**
5. **Check deployment** by accessing:
   - Backend API: `http://<your-server-ip>:8080/api/authors`
   - Frontend: `http://<your-server-ip>` (if nginx configured)

## Performance Notes

- **First build** takes ~3-5 minutes (Maven dependency download, Node.js modules)
- **Subsequent builds** are much faster (~1-2 minutes) due to caching
- **Deployment** is atomic: New JAR is copied, then service restarts

---

*Last updated: 2026-10-11*
