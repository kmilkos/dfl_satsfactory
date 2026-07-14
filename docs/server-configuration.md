# Satisfactory Dedicated Server Configuration Guide

This document is the official technical reference for deploying and configuring Satisfactory Dedicated Servers (`AppID: 1690800` via SteamCMD).

## 1. System Requirements

Before deploying a dedicated server node, verify that the host machine meets the following hardware specs:

| Resource | Minimum (1-4 players) | Recommended (4+ players) |
| :--- | :--- | :--- |
| **CPU** | Dual-core 3.0 GHz+ (Intel/AMD) | Quad-core 3.6 GHz+ |
| **Memory** | 12 GB RAM | 16 GB - 32 GB RAM (Required for late-game) |
| **Storage** | 15 GB free space (SSD) | 30 GB+ free space (PCIe NVMe SSD) |
| **OS** | Ubuntu 22.04 LTS / Windows Server 2022 | Ubuntu 24.04 LTS (Docker-optimized) |

---

## 2. Server Installation (SteamCMD)

SteamCMD is used to download and update the server files.

### Linux Installation
```bash
# Add multiverse repository
sudo add-apt-repository multiverse
sudo apt-get update

# Install SteamCMD
sudo apt-get install steamcmd

# Run SteamCMD to fetch Satisfactory Dedicated Server
steamcmd +force_install_dir /home/steam/satisfactory +login anonymous +app_update 1690800 -beta public validate +quit
```

### Server Execution Ports
Satisfactory V2 protocol utilizes combined network communication over a single port. Ensure your firewall (ufw, security groups) has the following ports open:

*   **7777 UDP (Game / Query / Beacon combined) - MANDATORY**
*   **15000 UDP (Legacy Beacon - optional)**
*   **15777 UDP (Legacy Query - optional)**

---

## 3. Launch Parameters

Start the server using optimal launch parameters to configure memory bounds and networking bounds:

### Linux Launch Script (`start.sh`)
```bash
#!/bin/bash
/home/steam/satisfactory/FactoryServer.sh \
  -ServerQueryPort=7777 \
  -BeaconPort=15000 \
  -Port=7777 \
  -log \
  -unattended \
  -multihome=0.0.0.0
```

---

## 4. Configuration Directories & Save Files

### Save Game File Location
Satisfactory Dedicated Server stores saved `.sav` files in the following path:

*   **Linux:** `~/.local/share/FactoryGame/Saved/SaveGames/server/`
*   **Windows:** `%LOCALAPPDATA%\FactoryGame\Saved\SaveGames\server\`

*Note: Save filenames follow the format `ServerSave_<SlotName>_v<Version>.sav`.*

### Configuration Files (`*.ini`)
System configurations can be customized inside the following directory:
*   **Path:** `[ServerRoot]/FactoryGame/Saved/Config/LinuxServer/`

#### `ServerSettings.ini`
Controls standard server-side gameplay metrics:
```ini
[/Script/FactoryGame.FGServerSubsystem]
mMaxPlayers=4
mAutoSaveDelay=300
mServerPassword=MySecureForgePassword
mAutoPause=True
```

#### `Engine.ini`
Overrides networking tickrates to prevent late-game desynchronization:
```ini
[/Script/Engine.Player]
ConfiguredInternetSpeed=104857600
ConfiguredLanSpeed=104857600

[/Script/OnlineSubsystemUtils.IpNetDriver]
MaxClientRate=104857600
MaxInternetClientRate=104857600
NetServerMaxTickRate=60
```
