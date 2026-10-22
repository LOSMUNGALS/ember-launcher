import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nativeMacTarget, macBinaryArchitecture } from "../desktop/mac";
function macho(cpu: number) {
  const b = Buffer.alloc(32);
  b.writeUInt32LE(0xfeedfacf);
  b.writeUInt32LE(cpu, 4);
  return b;
}
test("Mac architecture check distinguishes ARM, Intel, universal, PE, and malformed headers", () => {
  assert.equal(macBinaryArchitecture(macho(0x100000c)), "arm64");
  assert.equal(macBinaryArchitecture(macho(0x1000007)), "x64");
  assert.equal(macBinaryArchitecture(Buffer.from("MZhello!")), "unknown");
  const fat = Buffer.alloc(48);
  fat.writeUInt32BE(0xcafebabe);
  fat.writeUInt32BE(2, 4);
  fat.writeUInt32BE(0x1000007, 8);
  fat.writeUInt32BE(0x100000c, 28);
  assert.equal(macBinaryArchitecture(fat), "arm64");
  fat.writeUInt32BE(300, 4);
  assert.equal(macBinaryArchitecture(fat), "unknown");
  assert.equal(macBinaryArchitecture(Buffer.alloc(2)), "unknown");
});
test("native bundle preflight checks executable architecture and Rosetta availability", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ember-mac-"));
  const bundle = path.join(dir, "Game.app");
  const bin = path.join(bundle, "Contents/MacOS");
  await mkdir(bin, { recursive: true });
  await writeFile(path.join(bin, "Game"), macho(0x1000007));
  assert.equal(await nativeMacTarget(bundle, 0, false), false);
  assert.equal(await nativeMacTarget(bundle, 0, true), true);
  await writeFile(path.join(bin, "Game"), macho(0x100000c));
  assert.equal(await nativeMacTarget(bundle, 0, false), true);
});
