import type { DownloadJob, PackageSource } from "./v2types";
import { communityKey } from "./community-title";
export function downloadStage(job: DownloadJob) {
  if (job.installedGameId)
    return {
      label: "Ready to play",
      step: 3,
      detail: "Installation registered in your library.",
    };
  if (job.status === "extracting" || job.status === "installing")
    return {
      label: job.status === "extracting" ? "Extracting" : "Installing",
      step: 2,
      detail: "Keep Ember open until this stage finishes.",
    };
  if (job.status === "completed")
    return {
      label:
        job.installationState === "needs-attention"
          ? "Installation needs attention"
          : "Downloaded · not installed",
      step: 1,
      detail:
        job.installationError ||
        "Download finished. Install the package or locate the installed game to enable Play.",
    };
  if (job.status === "external")
    return {
      label: "Waiting for download host",
      step: 0,
      detail: "Open the host page and complete its download steps.",
    };
  if (job.status === "queued" && job.retryAt)
    return {
      label: "Retry scheduled",
      step: 0,
      detail:
        "A temporary connection failure occurred. Partial files are preserved.",
    };
  return {
    label:
      (
        {
          queued: "Queued",
          connecting: "Connecting",
          downloading: "Downloading",
          verifying: "Verifying files",
          paused: "Paused",
          failed: "Download failed",
          canceled: "Canceled",
        } as Record<string, string>
      )[job.status] || job.status,
    step: 0,
    detail: job.resumeOnStartup
      ? "Interrupted transfer preserved. Resume from the saved files."
      : "",
  };
}
export function downloadAdvice(job: DownloadJob) {
  const error = job.error || "";
  if (/disk space|ENOSPC/i.test(error))
    return "Free disk space, then retry. Existing partial files are retained.";
  if (/SHA-256|integrity|hash mismatch/i.test(error))
    return "Integrity verification failed. Retry the download; do not install this package.";
  if (/403|401|expired|host transfer/i.test(error))
    return "The host may require a new session or link. Reopen the host page or choose another release.";
  if (/404|410/i.test(error))
    return "This release link is unavailable. Sync sources or choose another release.";
  if (
    job.package.transport === "torrent" &&
    (/peers|metadata|progress|seed/i.test(error) || job.status === "connecting")
  )
    return "Availability depends on peers. Retry later or choose another release; partial files remain in the download folder.";
  if (
    /progress|timeout|timed out|connection|network|socket|incomplete/i.test(
      error,
    )
  )
    return "Check your connection and retry. Ember resumes partial data when the source supports it.";
  return error ? "Retry the transfer or choose another source." : "";
}
export function sourceDiagnostics(source: PackageSource) {
  return {
    groups: new Set(
      source.packages.map((p) => communityKey(p.title)).filter(Boolean),
    ).size,
    status: !source.enabled
      ? "Disabled"
      : source.localSnapshot
        ? "Local snapshot"
        : source.error
          ? source.packages.length
            ? "Cached · refresh unavailable"
            : "No catalog loaded"
          : source.packages.length
            ? "Loaded"
            : "Not loaded",
    success: source.lastSuccess || source.updated,
    attempt: source.lastAttempt,
  };
}
