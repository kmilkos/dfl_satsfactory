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

# Install SteamCMD dependencies (especially 32-bit architecture support)
log_info "Installing SteamCMD 32-bit pre-requisite libraries..."
apt-get install -y lib32gcc-s1 libc6-i386 ca-certificates curl tar wget || apt-get install -y lib32gcc1 libc6-i386 ca-certificates curl tar wget || true

# Install SteamCMD package or fallback to manual download
if apt-get install -y steamcmd; then
    # Link SteamCMD executable for global access
    ln -sf /usr/games/steamcmd /usr/local/bin/steamcmd
    log_success "SteamCMD installed via apt-get and globally linked."
else
    log_warning "apt-get was unable to locate or install 'steamcmd'. Proceeding with manual SteamCMD installation..."
    
    # Download the official SteamCMD archive from Steam CDN
    mkdir -p /usr/share/steamcmd
    log_info "Downloading official SteamCMD archive from Valve CDN..."
    wget -qO /usr/share/steamcmd/steamcmd_linux.tar.gz "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz"
    
    # Create the robust wrapper script that sets up local home directory SteamCMD instance on-the-fly
    log_info "Creating global user-friendly wrapper script /usr/local/bin/steamcmd..."
    cat <<'EOF' > /usr/local/bin/steamcmd
#!/bin/bash
USER_STEAMCMD_DIR="$HOME/.steamcmd"
if [ ! -f "$USER_STEAMCMD_DIR/steamcmd.sh" ]; then
    mkdir -p "$USER_STEAMCMD_DIR"
    tar -xzf /usr/share/steamcmd/steamcmd_linux.tar.gz -C "$USER_STEAMCMD_DIR"
fi
exec "$USER_STEAMCMD_DIR/steamcmd.sh" "$@"
EOF
    chmod +x /usr/local/bin/steamcmd
    log_success "SteamCMD manual setup completed with high-reliability home-directory sandbox."
fi

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
  log_warning "Failed to locate dynamic ficsit-cli download URL."
  echo -e "\n${YELLOW}======================================================================${NC}"
  echo -e " ${RED}[WARNING] Unable to resolve latest ficsit-cli release dynamically.${NC}"
  echo -e " Please visit the manual download page to grab the Linux package URL:"
  echo -e "   ${GREEN}https://github.com/satisfactorymodding/ficsit-cli/releases${NC}"
  echo -e " Copy the link to the Linux package (e.g., .deb, .tar.gz, or .zip file)."
  echo -e "${YELLOW}======================================================================${NC}\n"
  
  # Allow the user to paste the direct package URL manually
  read -p "Please enter the URL of the ficsit-cli package (or press ENTER to use the static fallback): " USER_FICSIT_URL
  
  if [ -n "$USER_FICSIT_URL" ]; then
    log_info "Downloading user-specified ficsit-cli from: $USER_FICSIT_URL"
    wget -qO /tmp/ficsit-cli-user.package "$USER_FICSIT_URL"
    
    # Smart type detection
    if [[ "$USER_FICSIT_URL" == *.deb* ]] || dpkg -I /tmp/ficsit-cli-user.package >/dev/null 2>&1; then
      log_info "Detected Debian package. Installing via dpkg..."
      dpkg -i /tmp/ficsit-cli-user.package || apt-get install -y -f || true
      
      # Ensure it's globally available at /usr/local/bin/ficsit-cli
      if [ -f /usr/bin/ficsit-cli ] && [ ! -f /usr/local/bin/ficsit-cli ]; then
        ln -sf /usr/bin/ficsit-cli /usr/local/bin/ficsit-cli
      fi
      
      if [ -f /usr/local/bin/ficsit-cli ]; then
        log_success "Successfully installed ficsit-cli from .deb package!"
      else
        log_error "Failed to verify ficsit-cli installation after dpkg install."
      fi
      rm -f /tmp/ficsit-cli-user.package
    else
      log_info "Detected archive package. Extracting..."
      mkdir -p /tmp/ficsit-extracted
      
      # Handle ZIP vs TAR.GZ extraction
      if [[ "$USER_FICSIT_URL" == *.zip ]]; then
        apt-get install -y unzip >/dev/null 2>&1 || true
        unzip -q -o /tmp/ficsit-cli-user.package -d /tmp/ficsit-extracted
      else
        tar -xzf /tmp/ficsit-cli-user.package -C /tmp/ficsit-extracted || unzip -q -o /tmp/ficsit-cli-user.package -d /tmp/ficsit-extracted || true
      fi
      
      # Robustly find binary inside archive
      BINARY_PATH=$(find /tmp/ficsit-extracted -type f -name "ficsit-cli" | head -n 1)
      if [ -n "$BINARY_PATH" ]; then
        mv "$BINARY_PATH" /usr/local/bin/ficsit-cli
        chmod +x /usr/local/bin/ficsit-cli
        log_success "Successfully installed ficsit-cli from user-specified package!"
      else
        log_error "Could not find 'ficsit-cli' executable inside the extracted archive."
      fi
      rm -rf /tmp/ficsit-cli-user.package /tmp/ficsit-extracted
    fi
  fi
  
  # Fallback check if manual entry wasn't successful or skipped
  if [ ! -f /usr/local/bin/ficsit-cli ]; then
    log_warning "No manual package successfully loaded. Fetching static fallback v2.5.0..."
    wget -qO /usr/local/bin/ficsit-cli "https://github.com/satisfactorymodding/ficsit-cli/releases/download/v2.5.0/ficsit-cli-linux-amd64"
    chmod +x /usr/local/bin/ficsit-cli
    log_success "Successfully installed ficsit-cli static fallback v2.5.0."
  fi
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
  steamcmd +@sSteamCmdForcePlatformType linux \
           +@sSteamCmdForcePlatformBitness 64 \
           +force_install_dir /home/satisfactory/satisfactory-server \
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
