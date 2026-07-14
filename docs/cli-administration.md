# Ficsit-CLI Mod Administration Guide

The `ficsit-cli` is an open-source command-line tool designed for headless administration, allowing server operators to automate Satisfactory mod installations, profiles, and dependency resolutions.

---

## 1. Installation

The `ficsit-cli` utility can be compiled from source or retrieved as a pre-built binary for Linux and Windows systems.

### Quick Binary Installation (Linux)
```bash
# Download latest ficsit-cli release
curl -s https://api.github.com/repos/checkandmate/ficsit-cli/releases/latest \
  | grep "browser_download_url.*linux" \
  | cut -d : -f 2,3 \
  | tr -d \" \
  | wget -qi -

# Make it executable and move to bin path
chmod +x ficsit-cli-linux
sudo mv ficsit-cli-linux /usr/local/bin/ficsit-cli

# Verify installation
ficsit-cli --version
```

---

## 2. Setting Up Server Mod Profiles

 Headless Satisfactory servers require a distinct modding configuration compared to standard client instances.

### Initiating a Server Directory Profile
Navigate to your game server directory and initialize ficsit-cli to recognize the installation:

```bash
cd /home/steam/satisfactory

# Initialize ficsit-cli and register server directories
ficsit-cli init --path="/home/steam/satisfactory"
```

This creates a `ficsit-cli.json` file in the directory tracking the Satisfactory Mod Loader (SML) status and mod dependencies.

---

## 3. Core CLI Administration Commands

Administrators can execute standard tasks through the CLI interface:

### Update Mod Repositories
Always fetch the latest mod listings from the Ficsit.app registry before performing updates:
```bash
ficsit-cli update
```

### Searching for Mods
```bash
ficsit-cli search "Remote Monitoring"
```

### Installing SML and Mods
SML (Satisfactory Mod Loader) is a mandatory requirement for server modding. Install it alongside your chosen mods:
```bash
# Install SML for server compatibility
ficsit-cli install SML

# Install active mods (e.g., Ficsit Remote Monitoring)
ficsit-cli install "FicsitRemoteMonitoring"
```

### Mod Maintenance & Management
```bash
# List all currently installed mods
ficsit-cli list

# Upgrade all installed mods to their latest compatible versions
ficsit-cli upgrade

# Disable modding sub-systems temporary without uninstalling files
ficsit-cli profile disable-mods

# Remove a specific mod and its unused dependencies
ficsit-cli remove "FicsitRemoteMonitoring"
```

---

## 4. Automation & Deployment Scripting

To keep server mods up-to-date automatically during server reboots, integrate `ficsit-cli` updates in your launch routine:

### Auto-Update Launcher Script (`run-server.sh`)
```bash
#!/bin/bash
echo "==> Fetching latest Ficsit.app mod indices..."
ficsit-cli update

echo "==> Ensuring Satisfactory Mod Loader (SML) is up-to-date..."
ficsit-cli install SML

echo "==> Upgrading all installed mods..."
ficsit-cli upgrade --yes

echo "==> Starting Satisfactory Server..."
./FactoryServer.sh -log -unattended
```
