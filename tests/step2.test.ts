import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  stat,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { AccountClient } from "../desktop/accounts";
import { reviewSummary } from "../desktop/reviews";
import { CatalogService } from "../desktop/catalog";
import { StateStore } from "../desktop/state";
import {
  folderInventory,
  verifiedFolderCopy,
  managedMoveSource,
  retargetMoveMarker,
} from "../desktop/storage";
import { matchesSearch } from "../src/library-search";
import { artworkFile } from "../desktop/artwork";
const user = {
    id: 1,
    username: "fixture",
    email: "fixture@example.com",
    role: "user",
  },
  token = "test-session-token-".repeat(3);
function protection() {
  const key = randomBytes(32);
  return {
    available: () => true,
    encrypt: (value: string) => {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decrypt: (value: Buffer) => {
      const cipher = createDecipheriv(
        "aes-256-gcm",
        key,
        value.subarray(0, 12),
      );
      cipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([
        cipher.update(value.subarray(28)),
        cipher.final(),
      ]).toString("utf8");
    },
  };
}
test("remembered sessions encrypt only a service-scoped token, restore after verification, and disappear on logout", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-remember-")),
    secure = protection(),
    original = globalThis.fetch;
  let mode = "online",
    checks = 0;
  globalThis.fetch = (async (url) => {
    if (String(url).endsWith("/login")) return Response.json({ token, user });
    if (String(url).endsWith("/me")) {
      checks++;
      if (mode === "offline") throw Error("offline");
      if (mode === "revoked")
        return Response.json({ error: "Session expired" }, { status: 401 });
      return Response.json({ user });
    }
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    const client = new AccountClient(root, secure);
    await client.login({
      identifier: "fixture",
      password: "fixture-only-password",
      remember: true,
    });
    const saved = await readFile(path.join(root, "remembered-session.bin"));
    assert.ok(!saved.includes(Buffer.from(token)));
    assert.ok(!saved.includes(Buffer.from("fixture-only-password")));
    const restored = new AccountClient(root, secure);
    await restored.load();
    assert.equal(restored.status().user, null);
    mode = "offline";
    await assert.rejects(restored.restore());
    assert.equal(restored.status().user, null);
    assert.ok((await stat(path.join(root, "remembered-session.bin"))).size > 0);
    mode = "online";
    await restored.restore();
    assert.equal(restored.user?.username, "fixture");
    assert.equal(checks, 2);
    await restored.logout();
    await assert.rejects(stat(path.join(root, "remembered-session.bin")));
    await client.login({ remember: true });
    const revoked = new AccountClient(root, secure);
    await revoked.load();
    mode = "revoked";
    await assert.rejects(revoked.restore(), /expired/);
    assert.equal(revoked.status().user, null);
    await assert.rejects(stat(path.join(root, "remembered-session.bin")));
    await assert.rejects(
      new AccountClient(root).login({ remember: true }),
      /Secure device storage/,
    );
    mode = "online";
    await client.login({ remember: false });
    await assert.rejects(stat(path.join(root, "remembered-session.bin")));
  } finally {
    globalThis.fetch = original;
  }
});
test("review summaries accept new Steam envelopes and cached metadata backfills reviews without refetching artwork", async () => {
  assert.deepEqual(
    reviewSummary({
      response: {
        query_summary: {
          total_reviews: 100,
          total_positive: 85,
          review_score_desc: "Very Positive",
        },
      },
    }),
    { positive: 85, total: 100, summary: "Very Positive" },
  );
  assert.equal(
    reviewSummary({
      response: { query_summary: { total_reviews: 10, total_positive: 20 } },
    }),
    undefined,
  );
  const store = new StateStore("unused");
  store.save = async () => {};
  const id = "730";
  store.data.catalog[id] = {
    appId: id,
    title: "Fixture",
    cover: "cover",
    banner: "",
    screenshots: [],
    description: "",
    developers: [],
    publishers: [],
    genres: [],
    tags: [],
    platforms: ["windows"],
    comingSoon: false,
    releaseDate: "",
    content: "allowed",
    updated: new Date().toISOString(),
    artworkVersion: 1,
  };
  let requests = 0;
  const service = new CatalogService(store, async (url) => {
    assert.match(url, /IUserReviewsService/);
    requests++;
    return {
      response: { query_summary: { total_reviews: 100, total_positive: 85 } },
    };
  });
  const result = await service.detail(id);
  assert.equal(result.reviews?.total, 100);
  assert.equal(result.cover, "cover");
  assert.equal(result.reviewsSource, "Steam");
  await service.detail(id);
  assert.equal(requests, 1);
  const outage = new CatalogService(store, async () => {
    throw Error("offline");
  });
  store.data.catalog[id].reviewsChecked = "2020-01-01";
  assert.equal((await outage.detail(id)).reviews?.positive, 85);
});
test("library search supports accent-insensitive names, one-character typos, transpositions and alternative names", () => {
  assert.equal(matchesSearch("ragnarok", "God of War Ragnarök"), true);
  assert.equal(matchesSearch("cyberpnuk", "Cyberpunk 2077"), true);
  assert.equal(matchesSearch("portal", "Portal 2"), true);
  assert.equal(matchesSearch("wrong title", "Portal 2"), false);
  assert.equal(matchesSearch("renamed", undefined, "Renamed game"), true);
});
test("storage copying verifies content, preserves empty folders, refuses nested/occupied targets and validates ownership", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-storage-")),
    id = randomUUID(),
    source = path.join(root, "Ember-" + id),
    destinationParent = path.join(root, "other"),
    target = path.join(destinationParent, "Ember-" + id);
  await mkdir(path.join(source, "empty"), { recursive: true });
  await mkdir(destinationParent);
  await writeFile(path.join(source, "game.exe"), "fixture");
  await writeFile(
    path.join(source, ".ember-install.json"),
    JSON.stringify({ id, target: source, relativeExecutable: "game.exe" }),
  );
  const inventory = await folderInventory(source);
  assert.equal(inventory.files.length, 2);
  await managedMoveSource(source, path.join(source, "game.exe"));
  await verifiedFolderCopy(source, target);
  assert.equal(
    await readFile(path.join(target, "game.exe"), "utf8"),
    "fixture",
  );
  assert.ok((await stat(path.join(target, "empty"))).isDirectory());
  assert.ok((await stat(source)).isDirectory());
  await retargetMoveMarker(target, target);
  await managedMoveSource(target, path.join(target, "game.exe"));
  await assert.rejects(
    verifiedFolderCopy(source, path.join(source, "nested")),
    /outside/,
  );
  await assert.rejects(verifiedFolderCopy(source, target), /EEXIST/);
  await assert.rejects(
    managedMoveSource(source, path.join(root, "not-a-game.exe")),
  );
  const linked = path.join(root, "linked");
  await symlink(
    source,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(folderInventory(linked), /Linked/);
  assert.equal(
    artworkFile("ember-art://library/custom-" + id + ".png", root),
    path.join(root, "custom-" + id + ".png"),
  );
  assert.equal(
    artworkFile("ember-art://library/../../private.png", root),
    null,
  );
});
