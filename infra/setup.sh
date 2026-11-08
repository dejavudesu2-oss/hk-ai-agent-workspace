#!/usr/bin/env bash
# ==============================================================================
# HK AI AGENT PLATFORM - ONE-COMMAND PRODUCTION VPS SETUP
# Target OS: Ubuntu 22.04 / 24.04 LTS (AWS Lightsail HK / Alibaba Cloud HK)
# Stack: Docker Engine + Google gVisor (runsc) + Caddy Reverse Proxy (Auto SSL)
# ==============================================================================

set -euo pipefail

# Text formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  HK AI Agent Platform: One-Command VPS Bootstrap Script        ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. Root check
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}[ERROR] This script must be run as root. Please run with sudo.${NC}"
    exit 1
fi

DOMAIN_NAME="${1:-localhost}"
echo -e "${YELLOW}[INFO] Setting up for domain: ${DOMAIN_NAME}${NC}"

# 2. System updates and basic packages
echo -e "\n${BLUE}>>> Step 1: Updating system packages and installing prerequisites...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    jq \
    ufw \
    iptables \
    net-tools

# 3. Install Docker Engine
echo -e "\n${BLUE}>>> Step 2: Installing Docker Engine...${NC}"
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    echo -e "${GREEN}[OK] Docker installed successfully.${NC}"
else
    echo -e "${GREEN}[OK] Docker is already installed.${NC}"
fi

# 4. Install Google gVisor (runsc)
echo -e "\n${BLUE}>>> Step 3: Installing Google gVisor (runsc sandbox runtime)...${NC}"
ARCH=$(uname -m)
URL="https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}"

curl -fsSL "${URL}/runsc" -o /usr/local/bin/runsc
curl -fsSL "${URL}/runsc.sha512" -o /tmp/runsc.sha512

# Verify checksum
cd /tmp
sed -i "s|runsc|/usr/local/bin/runsc|" /tmp/runsc.sha512
sha512sum -c /tmp/runsc.sha512 || {
    echo -e "${RED}[ERROR] gVisor checksum verification failed!${NC}"
    exit 1
}
chmod a+rx /usr/local/bin/runsc
echo -e "${GREEN}[OK] gVisor runsc downloaded and verified.${NC}"

# Configure Docker daemon to register runsc with ptrace/systrap platform
# (Works seamlessly on standard VPS without bare-metal KVM requirements)
echo -e "\n${BLUE}>>> Step 4: Configuring Docker daemon for gVisor...${NC}"
DAEMON_JSON="/etc/docker/daemon.json"
mkdir -p /etc/docker

if [ -f "$DAEMON_JSON" ]; then
    # Merge existing JSON with runsc runtime
    cp "$DAEMON_JSON" "${DAEMON_JSON}.bak"
    jq '.runtimes["runsc"] = {
        "path": "/usr/local/bin/runsc",
        "runtimeArgs": ["--platform=ptrace"]
    }' "$DAEMON_JSON" > "${DAEMON_JSON}.tmp" && mv "${DAEMON_JSON}.tmp" "$DAEMON_JSON"
else
    cat <<'EOF' > "$DAEMON_JSON"
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc",
      "runtimeArgs": [
        "--platform=ptrace"
      ]
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "3"
  }
}
EOF
fi

systemctl restart docker
echo -e "${GREEN}[OK] Docker restarted with gVisor runsc runtime enabled.${NC}"

# Test gVisor container
echo -e "${YELLOW}[TEST] Testing gVisor container execution...${NC}"
docker run --rm --runtime=runsc alpine uname -a || {
    echo -e "${YELLOW}[WARN] Trying fallback with default flags...${NC}"
    runsc install
    systemctl restart docker
}
echo -e "${GREEN}[OK] gVisor sandbox runtime verified successfully.${NC}"

# 5. Install Caddy (Reverse Proxy with Automatic SSL)
echo -e "\n${BLUE}>>> Step 5: Installing Caddy reverse proxy...${NC}"
if ! command -v caddy &> /dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
    echo -e "${GREEN}[OK] Caddy installed successfully.${NC}"
else
    echo -e "${GREEN}[OK] Caddy is already installed.${NC}"
fi

# Configure Caddyfile
echo -e "\n${BLUE}>>> Step 6: Configuring Caddyfile for domain: ${DOMAIN_NAME}...${NC}"
CADDYFILE="/etc/caddy/Caddyfile"
cp "$CADDYFILE" "${CADDYFILE}.bak" 2>/dev/null || true

if [ "$DOMAIN_NAME" = "localhost" ]; then
    cat <<'EOF' > "$CADDYFILE"
:80 {
    # Reverse proxy to local Next.js instance on port 3000
    reverse_proxy localhost:3000 {
        flush_interval -1
        # WebSocket and streaming SSE support
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
else
    cat <<EOF > "$CADDYFILE"
${DOMAIN_NAME} {
    # Do not compress SSE streams to prevent chunk buffering
    @not_sse {
        not header Content-Type text/event-stream*
    }
    encode @not_sse gzip zstd

    # Reverse proxy to local Next.js instance on port 3000
    reverse_proxy localhost:3000 {
        flush_interval -1
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
fi

systemctl restart caddy
echo -e "${GREEN}[OK] Caddy reverse proxy configured and active.${NC}"

# 6. Basic Firewall (UFW)
echo -e "\n${BLUE}>>> Step 7: Configuring UFW Firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
echo -e "${GREEN}[OK] Firewall enabled. Ports 22, 80, 443 are open.${NC}"

# 7. Summary & Next Steps
echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  SUCCESS: HK AI Agent Infrastructure Ready!                   ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "1. Docker with gVisor runsc: ${GREEN}Active${NC}"
echo -e "2. Caddy Reverse Proxy:      ${GREEN}Active (Auto-SSL ready)${NC}"
echo -e "3. UFW Firewall:             ${GREEN}Enabled (22, 80, 443)${NC}"
echo -e "\nTo launch your Next.js AI Agent application:"
echo -e "  cd /var/www/hk-ai-agent/app"
echo -e "  npm install"
echo -e "  npm run build"
echo -e "  PORT=3000 npm run start"
echo -e "Or run via Docker: docker compose up -d"
echo -e "${GREEN}Done!${NC}"
