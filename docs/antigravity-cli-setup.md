# Antigravity CLI & Host Storage Guide

This document details the installation of the Antigravity CLI (`agy`) on a host and how to customize the "brain" storage directory (containing conversation history and artifacts) when running inside virtual environments or unprivileged Proxmox LXC containers.

## 1. Antigravity CLI (`agy`) Installation

The Antigravity CLI is a lightweight, terminal-based interface designed for fast agent pairing and codebase interaction.

### System Prerequisites
* **curl** must be installed on the host.
* **git** is recommended to allow the agent to inspect commits and track workspace files.

### Installation Commands
Run the appropriate script in your terminal to install the binary:

* **Linux / macOS:**
  ```bash
  curl -fsSL https://antigravity.google/cli/install.sh | bash
  ```

* **Windows (PowerShell):**
  ```powershell
  irm https://antigravity.google/cli/install.ps1 | iex
  ```

### First-Time Initialization
1. Launch the interactive TUI by running:
   ```bash
   agy
   ```
2. **Authentication:** On first run, the CLI prompts you to authenticate. If you are on a remote server via SSH, copy the displayed authorization URL, open it in a browser on your local machine, and paste the returned verification token back into the terminal.
3. **Workspace context:** Always start `agy` from your project's root folder to ensure the agent has direct visibility over your codebase.

---

## 2. Moving the "Brain" to a Network Share (Proxmox LXC Guide)

When running inside an unprivileged LXC container (e.g. ID `114`), kernel restrictions block mounting Windows/SMB network shares directly inside the container (`Operation not permitted`). 

To store your conversation logs and artifacts on a network share like `\\192.168.1.2\storage\the_vault`, you must mount it on the Proxmox Host and bind-mount it into the container.

### Step 1: Mount the Share on the Proxmox Host
Connect to your **Proxmox Host** via SSH and mount the SMB share:
```bash
# Create mount point on host
mkdir -p /mnt/storage

# Mount the SMB share using guest access
mount -t cifs -o guest,vers=3.0 //192.168.1.2/storage /mnt/storage
```
*To persist the mount on host reboot, add this to the host's `/etc/fstab`:*
```text
//192.168.1.2/storage /mnt/storage cifs guest,vers=3.0,x-systemd.automount 0 0
```

### Step 2: Transfer Existing Brain Files
Before mapping the mount, move your current logs from the container's disk to the network vault:
```bash
# Copy current brain files to the share
cp -a /var/lib/lxc/114/rootfs/root/.gemini/antigravity-cli/brain/* /mnt/storage/the_vault/

# Clean up the container's local directory to avoid overlay conflicts
rm -rf /var/lib/lxc/114/rootfs/root/.gemini/antigravity-cli/brain/*
```

### Step 3: Configure LXC Bind-Mount
Run the following container configuration command on your **Proxmox Host** to bind the host folder to the container's path:
```bash
# Add bind mount mapping from host to container 114
pct set 114 -mp0 /mnt/storage/the_vault,mp=/root/.gemini/antigravity-cli/brain
```
*(If `mp0` is already in use by another mount point, replace it with `mp1` or `mp2`.)*

### Step 4: Reboot the Container
Restart the container from the host to apply the configuration:
```bash
pct reboot 114
```
The CLI will now automatically write and index all transcripts and artifacts directly on your network share at `\\192.168.1.2\storage\the_vault`!
