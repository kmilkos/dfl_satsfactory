# Ficsit Remote Monitoring (FRM) Integration Guide

Ficsit Remote Monitoring (FRM) is a Satisfactory server mod that opens a local web server on the Dedicated Server host, exposing deep in-game operational statistics through a JSON REST API and WebSocket events.

---

## 1. Installation & Initialization

First, SML must be installed. Then, deploy the FRM mod using `ficsit-cli`:

```bash
ficsit-cli install FicsitRemoteMonitoring
```

Upon launching, FRM initializes a web server on the host.

### Port Configuration
The default port is `8080`. You can configure this inside the mod configuration file located at:
*   `[ServerRoot]/FactoryGame/Configs/FicsitRemoteMonitoring.cfg`

```json
{
  "Port": 8080,
  "Address": "0.0.0.0",
  "EnableREST": true,
  "EnableWebSocket": true,
  "UpdateInterval": 1.0
}
```

---

## 2. REST API Specification

FRM exposes multiple endpoints to query state. All payloads are returned as standard JSON arrays.

### Core Telemetry Endpoints

#### `GET /getPower`
Returns the status of all isolated power grids:
```json
[
  {
    "PowerID": 1,
    "PowerProduced": 4200.0,
    "PowerConsumed": 3150.5,
    "PowerCapacity": 5000.0,
    "PowerMaxConsumed": 3800.0,
    "BatteryCharge": 12000.0,
    "BatteryCapacity": 12000.0
  }
]
```

#### `GET /getPlayer`
Returns active players, coordinates, ping, and health status:
```json
[
  {
    "PlayerName": "Greg_DFL",
    "PlayerLocation": { "X": 142050, "Y": -210332, "Z": 5420 },
    "PlayerPing": 42,
    "PlayerHealth": 100.0
  }
]
```

#### `GET /getProduction`
Returns factory throughput statistics:
```json
[
  {
    "ItemName": "Reinforced Iron Plate",
    "ProductionRate": 15.0,
    "ConsumptionRate": 12.5,
    "CurrentRate": 2.5
  },
  {
    "ItemName": "Screws",
    "ProductionRate": 120.0,
    "ConsumptionRate": 120.0,
    "CurrentRate": 0.0
  }
]
```

---

## 3. Real-Time WebSockets Telemetry

For low-latency real-time visualizations (e.g., streaming chats or graphing production ticks), configure a WebSocket client connection:

*   **WebSocket URI:** `ws://[ServerIP]:8080/ws`

### Subscribing to Chat Feed
Send a subscription command in JSON format:
```json
{
  "command": "subscribe",
  "topic": "chat"
}
```

### Receiving Telemetry Ticks
FRM publishes system stats at fixed intervals:
```json
{
  "topic": "telemetry",
  "data": {
    "tps": 59.94,
    "cpu": 18.5,
    "ram": 14.2,
    "activePlayers": 2
  }
}
```

---

## 4. REST Client Implementation (Node.js)

Below is an elegant TypeScript example of a backend service proxying the Ficsit Remote Monitoring REST endpoints:

```typescript
import axios from 'axios';

interface PowerGrid {
  PowerID: number;
  PowerProduced: number;
  PowerConsumed: number;
  PowerCapacity: number;
}

export async function fetchPowerGrid(serverIp: string, port = 8080): Promise<PowerGrid[]> {
  try {
    const url = `http://${serverIp}:${port}/getPower`;
    const response = await axios.get<PowerGrid[]>(url, { timeout: 1500 });
    return response.data;
  } catch (error) {
    console.error("FRM unreachable:", error);
    return [];
  }
}
```
