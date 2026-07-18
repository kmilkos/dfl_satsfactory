# 🪐 FICSIT Sector Alpha | Satisfactory Server Panel

[![React](https://img.shields.github.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.github.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.github.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.github.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62B)](https://vitejs.dev/)
[![Gemini](https://img.shields.github.io/badge/Gemini%20AI-8E75C8?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev/)

An industrial-grade, fully reactive administrative control dashboard and telemetry status portal for dedicated **Satisfactory** game servers. Monitor, automate, and expand your factory operations with integrated AI sysadmin modules.

---

## 🚀 Key Features

### 🖥️ Server Control & Modding
* **Systemd Daemon Control:** Instant start, stop, restart, and updating for the Satisfactory Linux service.
* **SML Mod Manager:** Full Satisfactory Mod Loader dependency resolution, mod searching (with fuzzy and direct lookup match rescue), installation, and mod profile management.

### 📊 Real-Time Factory Telemetry
* **Uplink Metrics:** Monitor server CPU, RAM utilization, and ticks-per-second (TPS) parameters.
* **Power Grid Statistics:** Real-time production vs. capacity measurements synced across all active electrical grids.
* **Factory Analytics:** Count of dynamic factory buildings, player latencies, and item production throughput.

### 🤖 Mascot Greg (AI Sysadmin)
* **Virtual Player Injection:** Mascot Greg floats as a virtual Pioneer on the server dashboard with quantum latency.
* **Gemini Powered Chat:** An integrated automated conversation daemon responding to in-game chat events.
* **Adjustable Personalities:** Swap between Sarcastic, Helpful, Panic, or Passive-Aggressive AI adjusters.
* **Google Authentication:** Configurable client ID OAuth access keys to leverage active cloud subscriptions.

### 📂 Save & Snapshot Backups
* **Automated Intervals:** Periodic snapshot configuration.
* **Manual Snapshots:** One-click save state capture.
* **Storage Purge:** Administrative bulk backup snapshot deletion with confirm prompts.

### 🌐 Public Status Portal
* A sleek, responsive, glassmorphic visitor view displaying live server coordinates (with instant copy), online status, dynamic relay uptime, and live power production ratios.

---

## 🛠️ Tech Stack
* **Frontend:** React (Vite), TypeScript, Tailwind CSS, Lucide icons, Framer Motion, Recharts
* **Backend:** Node.js, Express, ESBuild, Systemd integration, HTTPS queries (Satisfactory Native API), GraphQL queries (Satisfactory Mod Repository)
* **AI Engine:** Google Gemini API integration

---

## ⚙️ Installation & Running

### Prerequisites
* Node.js (v18+)
* Linux host running `satisfactory` systemd service
* Ficsit Remote Monitoring (FRM) mod installed on game server

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kmilkos/dfl_satsfactory.git
   cd dfl_satsfactory
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Copy `.env.example` to `.env` and configure your settings:
   ```bash
   cp .env.example .env
   ```

4. **Build assets:**
   ```bash
   npm run build
   ```

5. **Run the server:**
   ```bash
   npm start
   ```
   Or run the dev server locally:
   ```bash
   npm run dev
   ```

---

## 📂 Project Structure
```
├── data/                 # Server configuration state storage
├── dist/                 # Compiled assets for production
├── src/
│   ├── components/       # UI panels (Operations, Settings, Portal, Chat)
│   ├── types.ts          # Telemetry and server type interfaces
│   ├── index.css         # Styling utilities and overrides
│   └── App.tsx           # Main application router and state manager
├── server.ts             # Backend daemon script (express, API, FRM proxy)
├── package.json          # Node dependencies and scripts
└── tsconfig.json         # TS compiler configurations
```

---

## ⚠️ FICSIT Inc. Disclaimer
> [!WARNING]
> All data transmitted via the FICSIT Mesh Network is the exclusive property of FICSIT Inc. Any unauthorized interception or modification of telemetry data is subject to immediate Pioneer contract termination and subsequent recycling. **Construct. Automate. Explore. Exploit.**
