import { hashFile } from "./downloads";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  realpath,
  lstat,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { folderInventory, verifiedFolderCopy } from "./storage";
import {
  validateSave,
  SAVE_LIMIT,
  type SavePayload,
} from "../server/cloud-saves.mjs";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const validId = (id: string) => /^[0-9a-f-]{36}$/.test(id);
export class SaveVersions {
  constructor(readonly root: string) {}
  private async removeOwned(directory: string) {
    const absolute = path.resolve(directory);
    if (
      path.dirname(absolute) !== path.resolve(this.root) ||
      !validId(path.basename(absolute))
    )
      throw Error("Unsafe backup cleanup path.");
    await rm(absolute, { recursive: true, force: true });
  }
  async initialize() {
    await mkdir(this.root, { recursive: true });
    if ((await lstat(this.root)).isSymbolicLink())
      throw Error("Backup directory cannot be a link.");
  }
  async snapshot(key: string, name: string, source: string) {
    await this.initialize();
    const actual = await realpath(source);
    if (actual === path.parse(actual).root)
      throw Error("Choose a specific save folder, not a drive.");
    const id = randomUUID(),
      directory = path.join(this.root, id);
    await mkdir(directory);
    try {
      await verifiedFolderCopy(source, path.join(directory, "files"));
      const inventory = await folderInventory(path.join(directory, "files"));
      const files = [];
      for (const f of inventory.files)
        files.push({
          path: f.relative.split(path.sep).join("/"),
          sha256: await hashFile(path.join(inventory.root, f.relative)),
        });
      await writeFile(
        path.join(directory, "manifest.json"),
        JSON.stringify({
          format: 2,
          id,
          key,
          name,
          source: actual,
          created: new Date().toISOString(),
          files,
        }),
        { flag: "wx" },
      );
      return { id, directory };
    } catch (e) {
      await this.removeOwned(directory);
      throw e;
    }
  }
  async manifest(id: string, key: string) {
    if (!validId(id)) throw Error("Invalid backup version.");
    const directory = path.join(this.root, id);
    if ((await lstat(directory)).isSymbolicLink())
      throw Error("Linked backup is not supported.");
    const m = JSON.parse(
      await readFile(path.join(directory, "manifest.json"), "utf8"),
    );
    if (
      m.format !== 2 ||
      m.id !== id ||
      m.key !== key ||
      !Array.isArray(m.files)
    )
      throw Error("Backup does not belong to this game.");
    return m;
  }
  async list(key: string) {
    await this.initialize();
    const rows = [];
    for (const id of await readdir(this.root)) {
      if (!validId(id)) continue;
      try {
        const m = await this.manifest(id, key);
        rows.push({
          id,
          created: m.created,
          name: m.name,
          files: m.files.length,
        });
      } catch {}
    }
    return rows.sort((a, b) => b.created.localeCompare(a.created));
  }
  async payload(id: string, key: string): Promise<SavePayload> {
    const m = await this.manifest(id, key);
    const directory = path.join(this.root, id, "files"),
      inventory = await folderInventory(directory);
    if (inventory.bytes > SAVE_LIMIT)
      throw Error(
        "Cloud saves support up to 2 MB per game. Your local backup is preserved.",
      );
    const files = [];
    for (const file of inventory.files) {
      const relative = file.relative.split(path.sep).join("/"),
        data = await readFile(path.join(directory, file.relative));
      const expected = m.files.find((f: any) => f.path === relative);
      if (!expected || hash(data) !== expected.sha256)
        throw Error("Backup integrity check failed.");
      files.push({
        path: relative,
        data: data.toString("base64"),
        sha256: expected.sha256,
      });
    }
    if (files.length !== m.files.length)
      throw Error("Backup files are missing.");
    return validateSave({ key, name: m.name, files });
  }
  async importCloud(value: unknown) {
    const payload = validateSave(value);
    await this.initialize();
    const id = randomUUID(),
      directory = path.join(this.root, id);
    await mkdir(directory);
    try {
      await mkdir(path.join(directory, "files"));
      for (const f of payload.files) {
        const target = path.join(directory, "files", ...f.path.split("/"));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(f.data, "base64"), { flag: "wx" });
      }
      await writeFile(
        path.join(directory, "manifest.json"),
        JSON.stringify({
          format: 2,
          id,
          key: payload.key,
          name: payload.name,
          created: new Date().toISOString(),
          cloud: true,
          files: payload.files.map(({ path, sha256 }) => ({ path, sha256 })),
        }),
        { flag: "wx" },
      );
      return { id, directory };
    } catch (e) {
      await this.removeOwned(directory);
      throw e;
    }
  }
  async restore(id: string, key: string, name: string, target: string) {
    const m = await this.manifest(id, key),
      actual = await realpath(target);
    if (
      (await lstat(target)).isSymbolicLink() ||
      actual === path.parse(actual).root
    )
      throw Error("Choose a specific unlinked save folder.");
    const backupRoot = await realpath(this.root),
      relation = path.relative(actual, backupRoot);
    if (
      !relation ||
      (!relation.startsWith(".." + path.sep) &&
        relation !== ".." &&
        !path.isAbsolute(relation))
    )
      throw Error("Save folder must not contain Ember backups.");
    const inBackups = path.relative(backupRoot, actual);
    if (
      !inBackups ||
      (!inBackups.startsWith(".." + path.sep) &&
        inBackups !== ".." &&
        !path.isAbsolute(inBackups))
    )
      throw Error("Cannot restore into the backup directory.");
    const previous = await this.snapshot(key, name, target),
      parent = path.dirname(actual),
      staging = path.join(parent, ".ember-restore-" + randomUUID());
    try {
      await verifiedFolderCopy(path.join(this.root, id, "files"), staging);
      const inventory = await folderInventory(staging);
      if (inventory.files.length !== m.files.length)
        throw Error("Backup inventory changed.");
      for (const f of inventory.files) {
        const expected = m.files.find(
          (v: any) => v.path === f.relative.split(path.sep).join("/"),
        );
        if (
          !expected ||
          (await hashFile(path.join(staging, f.relative))) !== expected.sha256
        )
          throw Error(
            "Backup integrity check failed. Original saves are unchanged.",
          );
      }
      const old = await this.manifest(previous.id, key),
        current = await folderInventory(actual);
      if (current.files.length !== old.files.length)
        throw Error(
          "Current saves changed during restore. Close the game and try again.",
        );
      for (const f of current.files) {
        const expected = old.files.find(
          (v: any) => v.path === f.relative.split(path.sep).join("/"),
        );
        if (
          !expected ||
          (await hashFile(path.join(actual, f.relative))) !== expected.sha256
        )
          throw Error(
            "Current saves changed during restore. Close the game and try again.",
          );
      }
      if (
        (await realpath(target)) !== actual ||
        (await lstat(actual)).isSymbolicLink()
      )
        throw Error("Save folder changed. Restore canceled.");
      const rollback = path.join(parent, ".ember-previous-" + randomUUID());
      await rename(actual, rollback);
      try {
        await rename(staging, actual);
      } catch (e) {
        try {
          await rename(rollback, actual);
        } catch {
          throw Error(
            "Restore could not complete. Original saves are preserved at " +
              rollback +
              " and as backup " +
              previous.id,
          );
        }
        throw e;
      }
      return { directory: actual, previous: previous.id, rollback };
    } finally {
      const absolute = path.resolve(staging);
      if (
        path.dirname(absolute) === parent &&
        /^\.ember-restore-[0-9a-f-]{36}$/.test(path.basename(absolute))
      )
        await rm(absolute, { recursive: true, force: true }).catch(() => {});
    }
  }
}
