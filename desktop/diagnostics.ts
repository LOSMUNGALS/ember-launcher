import type { V2State } from "../src/v2types";
export function diagnosticReport(state: V2State, version: string) {
  return {
    format: "ember-diagnostics-v1",
    created: new Date().toISOString(),
    version,
    platform: process.platform,
    arch: process.arch,
    downloads: state.downloads
      .slice(-20)
      .map((j) => ({
        status: j.status,
        stage: j.installationState,
        bytes: j.downloaded,
        total: j.total,
        peers: j.peers || 0,
        issue: j.error
          ? "Download reported an error"
          : j.installationError
            ? "Installation needs attention"
            : undefined,
      })),
    sources: state.sources.map((s) => ({
      enabled: s.enabled,
      entries: s.packages.length,
      lastSuccess: s.lastSuccess,
      status: s.error ? "Refresh failed" : "Available",
    })),
  };
}
