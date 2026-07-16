# Cloudflare Routing & Tunnels Guide

This document details how to configure Cloudflare to properly handle Satisfactory Dedicated Server game connections, bypass proxies for game protocols, and set up secure Cloudflare Tunnels (`cloudflared`) for your Web Control Panel.

## 1. Cloudflare Proxy Bypass (DNS Only)

By default, Cloudflare proxies web traffic (HTTP/HTTPS on ports 80/443) using the **Orange Cloud** (🟠). However, Satisfactory game servers run over **UDP on port 7777**.

If the domain name you give to players is proxied through Cloudflare, the game client will fail to connect. You must bypass the proxy for game traffic:

* Go to your **Cloudflare Dashboard** -> **DNS** tab.
* Locate or create the A record for your game connection (e.g. `satisfactory.yourdomain.com`).
* Change the **Proxy status** from **Proxied** (🟠) to **DNS Only** (🔘 / Grey Cloud).
* Save the record. Players can now connect directly via `satisfactory.yourdomain.com:7777`.

## 2. Cloudflare Spectrum (Paid Protocol Proxying)

If you want to keep your origin IP hidden while routing raw game traffic, Cloudflare offers **Spectrum**:

* Spectrum allows proxying generic TCP/UDP applications.
* You can define a custom Spectrum app routing UDP port `7777` to your server's backend IP.
* *Note:* Spectrum for generic UDP/TCP is a paid feature (Pro/Business/Enterprise plans) and is not available on Free tier accounts.

---

## 3. Cloudflare Tunnels (cloudflared) for Web Panel

A **Cloudflare Tunnel** creates a secure, encrypted link between your local server and Cloudflare's network without opening public ports on your router or setting up firewalls. It is the gold standard for exposing the web management panel (port 3000).

### Can it route Satisfactory Game Traffic?
No. While Cloudflare Tunnels support arbitrary TCP/UDP transport, players would be required to install `cloudflared` on their local machines and run a client command to bind the connection. Therefore, **use Tunnels for the Web Panel only, and use DNS Only (Grey Cloud) for game connections.**

### Step-by-Step Tunnel Setup for the Web Panel:

1. **Install cloudflared on your server:**
   Download the latest package for your architecture. For Debian/Ubuntu:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Authenticate with Cloudflare:**
   Run the login command and click the URL to authorize access to your domain:
   ```bash
   cloudflared tunnel login
   ```

3. **Create the Tunnel:**
   Generate the tunnel instance (e.g., named `sats-panel`):
   ```bash
   cloudflared tunnel create sats-panel
   ```
   *Note the Tunnel ID and credentials JSON file path printed in the terminal.*

4. **Configure the Tunnel:**
   Create a configuration file at `/etc/cloudflared/config.yml` (or `~/.cloudflared/config.yml`):
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json

   ingress:
     - hostname: panel.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

5. **Route DNS traffic to your Tunnel:**
   Establish the CNAME DNS entry pointing to your tunnel daemon:
   ```bash
   cloudflared tunnel route dns sats-panel panel.yourdomain.com
   ```

6. **Run as a System Service:**
   Install and start the tunnel daemon as a persistent service:
   ```bash
   sudo cloudflared service install
   sudo systemctl enable --now cloudflared
   ```
   Your panel is now securely accessible worldwide at `https://panel.yourdomain.com` without opening port 3000 in your home router.
