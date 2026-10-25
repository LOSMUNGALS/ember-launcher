import type { Game } from "./types";
export type OS = "windows" | "mac";
export interface CatalogGame {
  steamAppId?: string;
  chartRank?: number;
  productType?: string;
  portrait?: string;
  artworkVersion?: number;
  origin?: 'community';
  purchaseUrl?: string;
  trailers?: string[];
  isFree?: boolean;
  discoveryList?: 'coming' | 'top';
  appId: string;
  title: string;
  cover: string;
  banner: string;
  screenshots: string[];
  description: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  tags: string[];
  platforms: OS[];
  comingSoon: boolean;
  releaseDate: string;
  releaseTimestamp?: number;
  reviews?: { positive: number; total: number; summary: string };
  price?: string;
  content: "allowed" | "explicit" | "uncertain";
  updated: string;
}
export interface Preferences {
  resumeDownloads?: boolean;
  region: string;
  concurrency: number;
  minimumPositive: number;
  minimumReviews: number;
  catalogUrl: string;
}
export interface PackageSource {
  lastAttempt?: string;
  lastSuccess?: string;
  localSnapshot?: boolean;
  snapshotOrigin?: string;
  fallbackUrl?: string;
  resolvedUrl?: string;
  id: string;
  name: string;
  description: string;
  url: string;
  enabled: boolean;
  updated?: string;
  error?: string;
  packages: GamePackage[];
}
export interface GamePackage {
  transport?: "torrent" | "host";
  sizeLabel?: string;
  uploadDate?: string;
  id: string;
  gameId: string;
  steamAppId?: string;
  title: string;
  sourceName: string;
  version: string;
  type: "archive" | "installer" | "drm-free" | "multiplayer";
  platforms: OS[];
  bytes: number;
  url: string;
  sha256: string;
  filename: string;
  install: { method: "zip" | "installer"; executable?: string };
  authorization: { license: string; distribution: string; url: string };
}
export type DownloadStatus =
  | "external"
  | "queued"
  | "connecting"
  | "downloading"
  | "paused"
  | "verifying"
  | "extracting"
  | "installing"
  | "completed"
  | "failed"
  | "canceled";
export interface DownloadJob {
  installationState?: 'downloaded'|'extracting'|'installing'|'ready'|'needs-attention';
  installationError?: string;
  resumeOnStartup?: boolean;
  retryAt?: string;
  lastProgress?: string;
  peers?: number;
  discovery?: string;
  outputPath?: string;
  id: string;
  package: GamePackage;
  sourceId: string;
  status: DownloadStatus;
  downloaded: number;
  total: number;
  speed: number;
  averageSpeed: number;
  eta?: number;
  created: string;
  updated: string;
  started?: string;
  destination: string;
  error?: string;
  attempts: number;
  priority: number;
  etag?: string;
  verified: boolean;
  installedGameId?: string;
}
export interface V2State {
  charts?: Partial<Record<'coming'|'top', {games:CatalogGame[];source:string;updated:string;nextRefresh:number;region:string;error?:string}>>;
  defaultSourcesVersion?: number;
  preferences: Preferences;
  sources: PackageSource[];
  downloads: DownloadJob[];
  catalog: Record<string, CatalogGame>;
  rankings: {
    ids: string[];
    positions?: Record<string, number>;
    updated?: string;
    nextRefresh: number;
    error?: string;
    region: string;
    source: string;
  };
  ownership: {
    steamId?: string;
    updated?: string;
    ids: string[];
    error?: string;
  };
  featured?: string;
  visits: number;
}
export interface V2Snapshot {
  launcherUpdate?:import('./launcher-update-types').LauncherUpdateState;
  sourcesRevision?: string;
  state: V2State;
  games: Game[];
  platform: string;
  running: string[];
  dataPath: string;
  busy: boolean;
  message: string;
}
export type V2Action =
  | "previewLauncherUpdate"
  | "launcherUpdateStatus" | "checkLauncherUpdate" | "installLauncherUpdate" | "announcementStatus" | "readAnnouncements"
  | "accountStatus" | "accountLogin" | "accountRegister" | "accountForgotPassword" | "accountLogout" | "accountConfigure" | "updates" | "publishUpdate"
  | "feedbackList" | "feedbackThread" | "feedbackImage" | "createFeedback" | "replyFeedback" | "moderateFeedback"
  | "repairGame"
  | "snapshot"
  | "importSteam"
  | "syncSteam"
  | "connectSteam"
  | "disconnectSteam"
  | "catalog"
  | "achievements"
  | "detail"
  | "detectInstall"
  | "rankings"
  | "saveGame"
  | "removeGame"
  | "launch"
  | "installSteam"
  | "store"
  | "addGame"
  | "updateGame"
  | "preferences"
  | "addSource"
  | "importSourceFile"
  | "source"
  | "syncSources"
  | "openDownload"
  | "download"
  | "downloadControl"
  | "installPackage"
  | "uninstall"
  | "reveal"
  | "offlineInstaller";
declare global {
  interface Window {
    ember2: {
      call(action: V2Action, payload?: any): Promise<any>;
      subscribe(fn: () => void): () => void;
    };
  }
}
