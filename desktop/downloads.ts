import { runTorrent } from "./torrents";
import { mkdir, stat, statfs, open, rename, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { requestHttps, type HttpClient } from "./http";
import type { StateStore } from "./state";
import type { DownloadJob, GamePackage } from "../src/v2types";
export async function hashFile(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export class DownloadManager {
  private active = new Map<
    string,
    { abort: AbortController; promise: Promise<void> }
  >();
  private retrying = new Set<string>();
  private closed = false;
  constructor(
    readonly root: string,
    private store: StateStore,
    private changed: () => void,
    private client: HttpClient = requestHttps,
  ) {}
  file(job: DownloadJob, partial = false) {
    return path.join(
      this.root,
      job.id +
        (partial ? ".part" : ".package" + path.extname(job.package.filename)),
    );
  }
  async initialize() {
    await mkdir(this.root, { recursive: true });
    for (const j of this.store.data.downloads) {
      j.speed = 0;
      j.averageSpeed = 0;
      j.eta = undefined;
      if (j.package.transport === "host") { if (!["completed", "canceled"].includes(j.status)) j.status = "external"; continue; }
      if (j.package.transport) { if (!["completed", "canceled", "failed", "external"].includes(j.status)) j.status = "paused"; continue; }
      if (!["completed", "canceled", "failed"].includes(j.status))
        j.status = "paused";
      j.downloaded = await stat(this.file(j, j.status !== "completed"))
        .then((s) => s.size)
        .catch(() => 0);
    }
    await this.store.save();
  }
  async enqueue(pkg: GamePackage, sourceId: string, destination: string) {
    if (
      this.store.data.downloads.some(
        (j) =>
          j.package.id === pkg.id &&
          j.sourceId === sourceId &&
          !["failed", "canceled", "completed"].includes(j.status),
      )
    )
      throw Error("This package is already queued.");
    const now = new Date().toISOString();
    const job: DownloadJob = {
      id: randomUUID(),
      package: structuredClone(pkg),
      sourceId,
      status: pkg.transport === "host" ? "external" : "queued",
      downloaded: 0,
      total: pkg.bytes,
      speed: 0,
      averageSpeed: 0,
      created: now,
      updated: now,
      destination,
      attempts: 0,
      priority: 0,
      verified: false,
    };
    this.store.data.downloads.push(job);
    await this.store.save();
    this.changed();
    this.pump();
    return job.id;
  }
  pump() {
    if (this.closed) return;
    for (const j of [...this.store.data.downloads].sort(
      (a, b) => b.priority - a.priority || a.created.localeCompare(b.created),
    )) {
      if (this.active.size >= this.store.data.preferences.concurrency) break;
      if (
        j.status !== "queued" ||
        this.active.has(j.id) ||
        this.retrying.has(j.id)
      )
        continue;
      const abort = new AbortController();
      const promise = this.run(j, abort.signal)
        .catch((e) => {
          j.status = "failed";
          j.error = "Download state could not be saved: " + String(e);
        })
        .finally(() => {
          this.active.delete(j.id);
          this.changed();
          this.pump();
        });
      this.active.set(j.id, { abort, promise });
    }
  }
  private async run(job: DownloadJob, signal: AbortSignal) {
    let file: Awaited<ReturnType<typeof open>> | undefined;
    job.status = "connecting";
    job.error = undefined;
    job.started ??= new Date().toISOString();
    job.attempts++;
    this.changed();
    try {
      if (job.package.transport === "torrent") {
        await runTorrent(job, signal, this.changed, () => this.store.save());
        return;
      }
      let offset = await stat(this.file(job, true))
        .then((s) => s.size)
        .catch(() => 0);
      if (offset > job.total) {
        await rm(this.file(job, true), { force: true });
        offset = 0;
      }
      const disk = await statfs(this.root);
      if (disk.bavail * disk.bsize < job.total - offset + 64 * 1024 * 1024)
        throw Error("Not enough free disk space for this package.");
      job.downloaded = offset;
      await this.store.save();
      if (offset < job.total) {
        const headers: Record<string, string> = {};
        if (offset) {
          headers.Range = `bytes=${offset}-`;
          if (job.etag) headers["If-Range"] = job.etag;
        }
        const response = await this.client(job.package.url, headers, signal);
        if (response.statusCode === 200) {
          offset = 0;
          job.downloaded = 0;
        } else if (response.statusCode === 206) {
          const range = String(response.headers["content-range"] || "").match(
            /^bytes (\d+)-(\d+)\/(\d+)$/,
          );
          if (
            !range ||
            Number(range[1]) !== offset ||
            Number(range[3]) !== job.total ||
            Number(range[2]) >= job.total
          ) {
            response.destroy();
            throw Error("Invalid resume response; partial file preserved.");
          }
        } else {
          response.resume();
          throw Error("Download server returned HTTP " + response.statusCode);
        }
        if (
          response.headers["content-encoding"] &&
          response.headers["content-encoding"] !== "identity"
        ) {
          response.destroy();
          throw Error(
            "Encoded transfer is not supported for exact-size packages.",
          );
        }
        job.etag =
          typeof response.headers.etag === "string"
            ? response.headers.etag
            : undefined;
        file = await open(this.file(job, true), offset ? "a" : "w", 0o600);
        job.status = "downloading";
        let sample = Date.now(),
          bytes = 0,
          lastSaved = Date.now();
        this.changed();
        for await (const chunk of response) {
          if (signal.aborted) throw Error("Interrupted");
          const buffer = Buffer.from(chunk);
          if (job.downloaded + buffer.length > job.total) {
            response.destroy();
            throw Error("Download exceeds registered package size.");
          }
          let written = 0;
          while (written < buffer.length) {
            const result = await file.write(
              buffer,
              written,
              buffer.length - written,
            );
            written += result.bytesWritten;
          }
          job.downloaded += buffer.length;
          bytes += buffer.length;
          const now = Date.now();
          if (now - sample >= 250) {
            job.speed = bytes / ((now - sample) / 1000);
            job.averageSpeed = job.averageSpeed
              ? job.averageSpeed * 0.7 + job.speed * 0.3
              : job.speed;
            job.eta = (job.total - job.downloaded) / job.averageSpeed;
            bytes = 0;
            sample = now;
            this.changed();
          }
          if (now - lastSaved > 1000) {
            await this.store.save();
            lastSaved = now;
          }
        }
        await file.sync();
        await file.close();
        file = undefined;
      }
      if (signal.aborted) throw Error("Interrupted");
      if (job.downloaded !== job.total)
        throw Error("Incomplete transfer. Resume or retry to continue.");
      job.status = "verifying";
      job.speed = 0;
      job.eta = undefined;
      this.changed();
      const hash = await hashFile(this.file(job, true));
      if (signal.aborted) throw Error("Interrupted");
      if (hash !== job.package.sha256) {
        await rm(this.file(job, true), { force: true });
        job.downloaded = 0;
        throw Error(
          "SHA-256 mismatch. Corrupt package removed; installation is blocked.",
        );
      }
      await rename(this.file(job, true), this.file(job));
      job.verified = true;
      job.status = "completed";
      job.error = undefined;
    } catch (e) {
      if (!signal.aborted) {
        job.error = String(e);
        job.status = "failed";
        if (
          !job.package.transport && job.attempts < 3 &&
          !/SHA-256|disk space|exceeds|resume response/.test(job.error)
        ) {
          job.status = "queued";
          this.retrying.add(job.id);
          setTimeout(
            () => {
              this.retrying.delete(job.id);
              this.pump();
            },
            1000 * 2 ** job.attempts,
          );
        }
      }
    } finally {
      await file?.close().catch(() => {});
      job.speed = 0;
      job.eta = undefined;
      job.updated = new Date().toISOString();
      await this.store.save();
      this.changed();
    }
  }
  async control(id: string, action: string) {
    const job = this.store.data.downloads.find((j) => j.id === id);
    if (!job) throw Error("Download not found.");
    if (["extracting", "installing"].includes(job.status))
      throw Error("Wait for installation to finish.");
    if (action === "pause" || action === "cancel") {
      if (job.status === "completed")
        throw Error("Completed downloads cannot be paused or canceled.");
      job.status = action === "pause" ? "paused" : "canceled";
      this.active.get(id)?.abort.abort();
      await this.active.get(id)?.promise;
      if (action === "cancel" && !job.package.transport) {
        await rm(this.file(job, true), { force: true });
        job.downloaded = 0;
      }
    } else if (action === "resume" || action === "retry") {
      if (!["paused", "failed", "canceled"].includes(job.status))
        throw Error("This download cannot be resumed.");
      job.status = "queued";
      job.attempts = 0;
      job.error = undefined;
    } else if (action === "top") {
      job.priority =
        Math.max(0, ...this.store.data.downloads.map((j) => j.priority)) + 1;
    } else if (action === "remove") {
      if (!["completed", "canceled", "failed", "external"].includes(job.status))
        throw Error("Pause or cancel the download first.");
      await rm(this.file(job, true), { force: true });
      await rm(this.file(job), { force: true });
      this.store.data.downloads = this.store.data.downloads.filter(
        (j) => j.id !== id,
      );
    } else throw Error("Unknown download action.");
    await this.store.save();
    this.changed();
    this.pump();
  }
  async verify(job: DownloadJob) {
    if (
      !job.verified ||
      job.status !== "completed" ||
      (await hashFile(this.file(job))) !== job.package.sha256
    )
      throw Error("Package integrity verification failed. Download again.");
  }
  async shutdown() {
    this.closed = true;
    await Promise.all(
      [...this.active.keys()].map((id) => this.control(id, "pause")),
    );
  }
}
