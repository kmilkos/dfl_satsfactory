export interface ServerState {
  status: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'UPDATING' | 'CRASHED';
  version: string;
  uptime: number; // in seconds
  playersOnline: number;
  maxPlayers: number;
  sessionName: string;
  autoBackupEnabled: boolean;
  backupIntervalMinutes: number;
  moddingEnabled: boolean;
  hasGeminiKey?: boolean;
  geminiModel?: string;
  autoHealEnabled?: boolean;
  gregPersonality?: string;
  gregGoogleEmail?: string;
  gregGoogleName?: string;
  gregGooglePicture?: string;
  useSubscriptionAI?: boolean;
  googleClientId?: string;
}

export interface Backup {
  id: string;
  filename: string;
  timestamp: string; // ISO string
  sizeBytes: number;
  isAuto: boolean;
  saveSlot: string;
}

export interface Mod {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  downloads: number;
  installed: boolean;
  enabled: boolean;
  dependencies: string[];
}

export interface PowerGridStats {
  gridId: number;
  producedMw: number;
  consumedMw: number;
  capacityMw: number;
  batteryChargeMj: number;
  batteryCapacityMj: number;
}

export interface PlayerInfo {
  name: string;
  pingMs: number;
  health: number;
  location: { x: number; y: number; z: number };
}

export interface ItemThroughput {
  name: string;
  productionRate: number;
  consumptionRate: number;
  currentRate: number; // net
}

export interface ServiceStats {
  mainPid: number;
  memoryMb: number;
  cpuUsagePct: number;
  activeState: string;
  subState: string;
}

export interface TelemetryData {
  cpuUsage: number; // percentage
  ramUsageGb: number; // in GB
  tps: number; // Ticks per second (target 60)
  service?: ServiceStats;
  powerGrids: PowerGridStats[];
  players: PlayerInfo[];
  throughput: ItemThroughput[];
  worldObjects?: number;
  sessionUptime?: number;
}

export interface TelemetryHistoryPoint {
  time: string;
  cpu: number;
  ram: number;
  serviceCpu?: number;
  serviceRam?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'GREG' | 'USER' | 'SERVER' | string;
  text: string;
  timestamp: string; // ISO string
}

export interface ConsoleLogLine {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND';
  message: string;
}
