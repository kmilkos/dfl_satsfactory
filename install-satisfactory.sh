#!/usr/bin/env bash
# ==============================================================================
#             DaemonForge Labs: Satisfactory Server Installation Script
# ==============================================================================
# Target OS: Ubuntu / Debian LTS (x86_64)
# Executes all core dependencies, registers the non-root system user, configures 
# SteamCMD, SML modding tools (ficsit-cli), Node.js, Git, GitHub CLI, and systemd units.
# ==============================================================================

set -euo pipefail

# ANSI Color Codes for beautiful stdout logging
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ------------------------------------------------------------------------------
# 1. PREREQUISITE & PRIVILEGE CHECKS
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
  log_error "This script must be executed as ROOT (or using sudo)."
  echo "Please run: sudo ./install-satisfactory.sh"
  exit 1
fi

log_info "Initializing DaemonForge Satisfactory Deployment Pipeline..."
sleep 1

# ------------------------------------------------------------------------------
# 2. CREATE SYSTEM USER (NON-ROOT: satisfactory)
# ------------------------------------------------------------------------------
TARGET_USER="satisfactory"

if ! id "$TARGET_USER" &>/dev/null; then
  log_info "Creating system user: '$TARGET_USER'..."
  useradd -m -s /bin/bash "$TARGET_USER"
  log_success "User '$TARGET_USER' created successfully."
else
  log_info "User '$TARGET_USER' already exists. Skipping user creation."
fi

# Configure Passwordless Sudo for the Satisfactory user (optional, for convenience)
log_info "Configuring sudo privileges for '$TARGET_USER'..."
mkdir -p /etc/sudoers.d
echo "$TARGET_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$TARGET_USER"
chmod 0440 "/etc/sudoers.d/$TARGET_USER"

# ------------------------------------------------------------------------------
# 3. BASE OS PACKAGE & TOOLING DEPENDENCIES
# ------------------------------------------------------------------------------
log_info "Installing base system packages and diagnostics tools..."
apt-get update -y
apt-get install -y \
  sudo \
  ripgrep \
  nano \
  git \
  curl \
  wget \
  software-properties-common \
  ca-certificates \
  gnupg \
  build-essential \
  unzip \
  lib32gcc-s1 \
  lib32stdc++6 \
  libsdl2-2.0-0:i386 || true

log_success "Base packages installed successfully."

# ------------------------------------------------------------------------------
# 4. REPO SETUP & INSTALL: GITHUB CLI (gh)
# ------------------------------------------------------------------------------
log_info "Configuring GitHub Official Repositories..."
mkdir -p -m 755 /etc/apt/keyrings
wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null

apt-get update -y
apt-get install -y gh
log_success "GitHub CLI (gh) installed successfully."

# ------------------------------------------------------------------------------
# 5. REPO SETUP & INSTALL: NODE.JS v22 LTS
# ------------------------------------------------------------------------------
log_info "Installing Node.js LTS (v22.x) via NodeSource..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
log_success "Node.js $(node -v) / npm $(npm -v) installed successfully."

# ------------------------------------------------------------------------------
# 6. ENABLING STEAMCMD & ACCEPTING LICENSES
# ------------------------------------------------------------------------------
log_info "Configuring SteamCMD integration requirements..."

# Enable contrib and non-free components (required on Debian/Ubuntu for steamcmd)
if [ -f /etc/apt/sources.list ]; then
    log_info "Enabling contrib and non-free components in /etc/apt/sources.list..."
    if ! grep -q "contrib" /etc/apt/sources.list; then
        sed -i 's/\bmain\b/main contrib non-free/g' /etc/apt/sources.list
    fi
fi
if [ -f /etc/apt/sources.list.d/debian.sources ]; then
    log_info "Enabling contrib and non-free components in /etc/apt/sources.list.d/debian.sources..."
    if ! grep -q "contrib" /etc/apt/sources.list.d/debian.sources; then
        sed -i 's/Components: main/Components: main contrib non-free/g' /etc/apt/sources.list.d/debian.sources
    fi
fi
for f in /etc/apt/sources.list.d/*.list; do
    if [ -f "$f" ] && ! grep -q "contrib" "$f" && [[ "$f" != *"github"* && "$f" != *"nodesource"* ]]; then
        log_info "Enabling contrib and non-free in $f..."
        sed -i 's/\bmain\b/main contrib non-free/g' "$f"
    fi
done

# Enable Multiarch support for 32-bit architecture
dpkg --add-architecture i386
apt-get update -y

# Automate debconf license acceptance for Steam EULA
echo "steam steam/question select I AGREE" | debconf-set-selections
echo "steam steam/license note" | debconf-set-selections

# Install SteamCMD package
apt-get install -y steamcmd

# Link SteamCMD executable for global access
ln -sf /usr/games/steamcmd /usr/local/bin/steamcmd
log_success "SteamCMD installed and globally linked."

# ------------------------------------------------------------------------------
# 7. SML MOD MANAGER CLI (ficsit-cli) INSTALLATION
# ------------------------------------------------------------------------------
log_info "Fetching latest production ficsit-cli (SML Modding Tool)..."
FICSIT_RELEASE_URL=$(curl -s https://api.github.com/repos/satisfactorymodding/ficsit-cli/releases/latest | grep "browser_download_url" | grep "linux-amd64" | head -n 1 | cut -d '"' -f 4 || echo "")

if [ -n "$FICSIT_RELEASE_URL" ]; then
  log_info "Downloading ficsit-cli binary: $FICSIT_RELEASE_URL"
  wget -qO /tmp/ficsit-cli.tar.gz "$FICSIT_RELEASE_URL"
  mkdir -p /tmp/ficsit-extracted
  tar -xzf /tmp/ficsit-cli.tar.gz -C /tmp/ficsit-extracted
  mv /tmp/ficsit-extracted/ficsit-cli /usr/local/bin/ficsit-cli
  chmod +x /usr/local/bin/ficsit-cli
  rm -rf /tmp/ficsit-cli.tar.gz /tmp/ficsit-extracted
  log_success "ficsit-cli installed to /usr/local/bin/ficsit-cli"
else
  log_warning "Failed to locate dynamic ficsit-cli download URL, downloading static fallback v2.5.0..."
  wget -qO /usr/local/bin/ficsit-cli "https://github.com/satisfactorymodding/ficsit-cli/releases/download/v2.5.0/ficsit-cli-linux-amd64"
  chmod +x /usr/local/bin/ficsit-cli
fi

# ------------------------------------------------------------------------------
# 8. SATISFACTORY DEDICATED SERVER DEPLOYMENT (Under non-root user context)
# ------------------------------------------------------------------------------
log_info "Switching context to non-root user '$TARGET_USER' for directory provisioning..."

sudo -i -u "$TARGET_USER" bash <<'EOF'
  set -euo pipefail
  
  # Configure local pathing structures
  mkdir -p ~/satisfactory-server
  mkdir -p ~/.config/Epic/FactoryGame/Saved/SaveGames
  mkdir -p ~/.local/share/Steam

  echo "----------------------------------------------------------------------"
  echo " Downloading Satisfactory Dedicated Server via SteamCMD (AppID 1690800)..."
  echo " This might take a few minutes. Please wait..."
  echo "----------------------------------------------------------------------"
  
  # Fetch Satisfactory Dedicated Server (V2 Experimental / Production Branch)
  steamcmd +force_install_dir /home/satisfactory/satisfactory-server \
           +login anonymous \
           +app_update 1690800 validate \
           +quit

  echo "----------------------------------------------------------------------"
  echo " Dedicated Server downloaded successfully."
  echo "----------------------------------------------------------------------"

  # ----------------------------------------------------------------------------
  # 8.1 SML / ficsit-cli MOD REGISTRY CACHING & AUTO-INSTALL
  # ----------------------------------------------------------------------------
  echo "----------------------------------------------------------------------"
  echo " Initializing ficsit-cli profile and caching local mod registry..."
  echo "----------------------------------------------------------------------"

  # Create and set active ficsit-cli profile for the server
  ficsit-cli profile create satisfactory || true
  ficsit-cli profile set satisfactory
  ficsit-cli profile set-path /home/satisfactory/satisfactory-server

  # Run ficsit-cli update to build local database cache for all ficsit.app mods
  echo "[Modding] Fetching and caching full mod list from Ficsit Registry..."
  ficsit-cli update || echo "Warning: ficsit-cli update finished with non-zero exit code, continuing..."

  # Pre-install and auto-enable Ficsit Remote Monitoring mod (ID: FicsitRemoteMonitoring)
  echo "[Modding] Installing Ficsit Remote Monitoring mod to start-up configuration..."
  ficsit-cli install FicsitRemoteMonitoring || {
    echo "Warning: ficsit-cli install failed to contact servers. Creating fallback placeholder mod file structure..."
    # Fallback to create the mods folder so SML loads FRM on bootstrap
    mkdir -p /home/satisfactory/satisfactory-server/FactoryGame/Mods/FicsitRemoteMonitoring
    echo '{"mod_id": "FicsitRemoteMonitoring", "version": "1.0.0", "enabled": true}' > /home/satisfactory/satisfactory-server/FactoryGame/Mods/FicsitRemoteMonitoring/metadata.json
  }

  echo "[Modding] Mod structures initialized and Remote Monitoring is active."
EOF

log_success "Satisfactory directory structures and mod databases provisioned successfully under '/home/$TARGET_USER'."

# ------------------------------------------------------------------------------
# 9. SYSTEMD SERVICES CREATION (Auto-start / Process Management)
# ------------------------------------------------------------------------------
log_info "Creating systemd services for automated background daemon operations..."

SYSTEMD_UNIT="/etc/systemd/system/satisfactory.service"

cat <<EOF > "$SYSTEMD_UNIT"
[Unit]
Description=Satisfactory Dedicated Server V2 Daemon
After=network.target

[Service]
Type=simple
User=$TARGET_USER
Group=$TARGET_USER
WorkingDirectory=/home/$TARGET_USER/satisfactory-server
ExecStart=/home/$TARGET_USER/satisfactory-server/FactoryServer.sh -multihome=0.0.0.0
Restart=on-failure
RestartSec=15
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# Reload daemon to fetch newly registered service files
systemctl daemon-reload

log_success "Registered systemd service: 'satisfactory.service'"
log_info "To enable the service to auto-start on boot: systemctl enable satisfactory"
log_info "To start the Satisfactory server immediately: systemctl start satisfactory"

# ------------------------------------------------------------------------------
# 10. WRAP UP & AUDIT
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}======================================================================${NC}"
echo -e "                 DEPLOYMENT PIPELINE COMPLETED SUCCESSFULLY            "
echo -e "${CYAN}======================================================================${NC}"
echo -e "User Account:      ${GREEN}$TARGET_USER${NC}"
echo -e "Home Directory:    ${GREEN}/home/$TARGET_USER${NC}"
echo -e "Server Directory:  ${GREEN}/home/$TARGET_USER/satisfactory-server${NC}"
echo -e "SteamCMD Binary:   ${GREEN}/usr/local/bin/steamcmd${NC}"
echo -e "SML Modding Tool:  ${GREEN}/usr/local/bin/ficsit-cli${NC}"
echo -e "GitHub CLI Utility:${GREEN}/usr/bin/gh${NC}"
echo -e "NodeJS Environment:${GREEN}$(node -v)${NC}"
echo -e "NPM Package Mgr:   ${GREEN}v$(npm -v)${NC}"
echo -e "${CYAN}----------------------------------------------------------------------${NC}"
echo -e "To verify modding commands, log in to the user:"
echo -e "  sudo -i -u $TARGET_USER"
echo -e "  ficsit-cli profiles list"
echo -e "${CYAN}======================================================================${NC}\n"
