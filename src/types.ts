export type Store = "local" | "steam" | "epic" | "gog";
export interface SteamAchievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  unlocked?: boolean;
  unlockedAt?: number;
  hidden?: boolean;
}
export interface SteamDashboard {
  achievementUpdated?: string;
  achievementMessage?: string;
  accountId?: string;
  playtimeMinutes?: number;
  lastPlayed?: number;
  localUpdated?: string;
  achievements?: SteamAchievement[];
  achievementTotal?: number;
  achievementUnlocked?: number;
  about?: string;
  aboutSource?: string;
  aboutUpdated?: string;
  deck?: "unknown" | "unsupported" | "playable" | "verified";
  deckUpdated?: string;
  errors?: string[];
}
export interface Game {
  catalogId?: string;
  unavailable?: boolean;
  lastLaunchRequested?: string;
  owned?: boolean;
  installed?: boolean;
  saved?: boolean;
  managed?: { directory: string; jobId: string; method: "zip" | "installer" };
  id: string;
  name: string;
  executable: string;
  args: string[];
  store: Store;
  steamId?: string;
  steam?: SteamDashboard;
  artwork?: string;
  hero?: string;
  logo?: string;
  themeColor?: string;
  productType?: string;
  macWorkload?: "unknown" | "light" | "moderate" | "heavy" | "extreme";
  macOptimization?: "automatic" | "unity";
  description: string;
  platform: "native" | "windows";
  seconds: number;
  lastPlayed?: string;
  added: string;
}
export interface Settings {
  wine: string;
  prefix: string;
  graphics: "default" | "wined3d" | "dxvk";
  windowsSteam?: string;
}
export interface MacHardware {
  platform: string;
  appleSilicon: boolean;
  chip: string;
  memoryGB: number;
  osVersion: string;
  rosetta: boolean;
  gpu: string;
}
export interface MacStatus {
  hardware: MacHardware;
  wine: string;
  wineVersion: string;
  prefix: string;
  prefixReady: boolean;
  dxvkPresent: boolean;
  windowsSteam: string;
  problems: string[];
}
export interface MacAssessment {
  allowed: boolean;
  reason: string;
  workload: string;
  fps: number;
  width: number;
  height: number;
  optimization: string;
}
export interface Library {
  version: 1;
  games: Game[];
  settings: Settings;
  steamRoots?: string[];
}
export interface Snapshot extends Library {
  platform: string;
  arch: string;
  running: string[];
  dataPath: string;
  mac?: MacStatus;
  assessments?: Record<string, MacAssessment>;
  steamSync?: {
    running: boolean;
    completed: number;
    total: number;
    message: string;
  };
}
export interface API {
  snapshot(): Promise<Snapshot>;
  add(): Promise<Game | null>;
  update(game: Game): Promise<void>;
  remove(id: string): Promise<void>;
  launch(id: string): Promise<void>;
  settings(value: Settings): Promise<void>;
  importSteam(): Promise<number>;
  syncSteam(): Promise<void>;
  openSteam(id: string, action: "run" | "install"): Promise<void>;
  installer(): Promise<void>;
  macSetup(
    action:
      | "detect"
      | "chooseWine"
      | "createPrefix"
      | "chooseSteam"
      | "startSteam"
      | "installGraphics"
      | "logs",
  ): Promise<MacStatus>;
  subscribe(callback: () => void): () => void;
}
declare global {
  interface Window {
    ember: API;
  }
}
