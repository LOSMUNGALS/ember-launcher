import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Accounts } from "./service.mjs";
import { validateSave, SAVE_LIMIT } from "./cloud-saves.mjs";
const file = (text = "fixture") => ({
  path: "folder/slot.dat",
  data: Buffer.from(text).toString("base64"),
  sha256: createHash("sha256").update(text).digest("hex"),
});
const payload = () => ({ key: "steam-123", name: "Fixture", files: [file()] });
test("cloud saves enforce identities, optimistic revisions, isolation and revoked sessions", async () => {
  const a = new Accounts(":memory:", "owner@example.com"),
    password = "Fixture-password-482618";
  try {
    await a.bootstrap(password);
    const admin = (await a.login({ identifier: "owner@example.com", password }))
      .token;
    assert.equal(a.cloudSave(admin, "steam-123").revision, 0);
    assert.equal(
      a.cloudSave(admin, "steam-123", {
        expectedRevision: 0,
        payload: payload(),
      }).revision,
      1,
    );
    assert.throws(
      () =>
        a.cloudSave(admin, "steam-123", {
          expectedRevision: 0,
          payload: payload(),
        }),
      /conflict/,
    );
    assert.equal(a.cloudSave(admin, "steam-123").revision, 1);
    assert.equal(
      a.cloudSave(admin, "steam-123", {
        expectedRevision: 1,
        payload: payload(),
      }).revision,
      2,
    );
    await a.register({
      username: "player",
      email: "player@example.com",
      password,
    });
    const user = a.db
      .prepare("SELECT id FROM users WHERE username=?")
      .get("player");
    a.decide(admin, user.id, "approved");
    const token = (await a.login({ identifier: "player", password })).token;
    assert.equal(a.cloudSave(token, "steam-123").payload, null);
    a.decide(admin, user.id, "revoked");
    assert.throws(() => a.cloudSave(token, "steam-123"), /revoked|expired/);
    assert.throws(
      () =>
        a.cloudSave(admin, "steam-456", {
          expectedRevision: 0,
          payload: payload(),
        }),
      /another game/,
    );
  } finally {
    a.close();
  }
});
test("save validation rejects traversal, reserved names, duplicate files, conflicting paths, corruption and size limits", () => {
  for (const name of [
    "../slot",
    "/slot",
    "C:/slot",
    "folder\\slot",
    "CON",
    "folder/../slot",
    "foo.",
    "foo/",
  ])
    assert.throws(
      () => validateSave({ ...payload(), files: [{ ...file(), path: name }] }),
      /Unsafe/,
    );
  assert.throws(
    () => validateSave({ ...payload(), files: [file(), file()] }),
    /duplicate/,
  );
  assert.throws(
    () => validateSave({ ...payload(), files: [{ ...file(), sha256: "x" }] }),
    /integrity/,
  );
  assert.throws(
    () =>
      validateSave({
        ...payload(),
        files: [{ ...file(), path: "folder" }, file()],
      }),
    /Conflicting/,
  );
  assert.throws(
    () =>
      validateSave({ ...payload(), files: [file("a".repeat(SAVE_LIMIT + 1))] }),
    /2 MB|Invalid save data/,
  );
  assert.equal(
    validateSave({ ...payload(), files: [file("a".repeat(SAVE_LIMIT))] }).files
      .length,
    1,
  );
});
