import WebTorrent from "webtorrent";
import { runTorrent, torrentDirectory } from "../desktop/torrents.ts";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import assert from "node:assert/strict";
await mkdir(".test-data", { recursive: true });
await mkdir("artifacts", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/torrent-throughput-")),
  data = randomBytes(16 * 1024 * 1024),
  file = path.join(root, "fixture.bin");
await writeFile(file, data);
const seeder = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
    utp: false,
    downloadLimit: -1,
    uploadLimit: -1,
  }),
  abort = new AbortController();
let timer;
try {
  const torrent = await new Promise((resolve, reject) => {
    seeder.once("error", reject);
    seeder.seed(file, { announce: [], pieceLength: 256 * 1024 }, resolve);
  });
  const job = {
    id: randomUUID(),
    package: { url: torrent.magnetURI, transport: "torrent" },
    destination: root,
    status: "queued",
    downloaded: 0,
    total: 0,
    speed: 0,
    averageSpeed: 0,
  };
  const started = performance.now();
  timer = setTimeout(() => abort.abort(), 30000);
  await runTorrent(
    job,
    abort.signal,
    () => {},
    async () => {},
    {
      clientOptions: {
        dht: false,
        tracker: false,
        lsd: false,
        natUpnp: false,
        natPmp: false,
        utp: false,
      },
      onTorrent: (download) => {
        assert.equal(download.strategy, "rarest");
        download.once("infoHash", () =>
          download.addPeer("127.0.0.1:" + seeder.torrentPort),
        );
      },
    },
  );
  const seconds = (performance.now() - started) / 1000,
    received = await readFile(path.join(torrentDirectory(job), "fixture.bin"));
  assert.equal(
    createHash("sha256").update(received).digest("hex"),
    createHash("sha256").update(data).digest("hex"),
  );
  assert.equal(job.status, "completed");
  const report = {
    bytes: received.length,
    seconds,
    megabytesPerSecond: received.length / seconds / 1000 ** 2,
    scope:
      "Controlled localhost torrent, not a measurement of public swarm speed",
    strategy: "rarest",
    limit: "unlimited",
  };
  await writeFile(
    "artifacts/torrent-throughput.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  clearTimeout(timer);
  await new Promise((resolve) => seeder.destroy(resolve));
}
