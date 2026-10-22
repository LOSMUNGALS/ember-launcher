import {
  mkdir,
  statfs,
  writeFile,
  rename,
  rm,
  realpath,
  readFile,
  stat,
  chmod,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import yauzl from "yauzl";
import { relativeTarget } from "./sources";
export function nativePackage(platforms: string[], host: string) {
  return host === "win32"
    ? platforms.includes("windows")
    : host === "darwin"
      ? platforms.includes("mac")
      : false;
}
export function safeArchiveEntry(name: string, mode: number) {
  if ((mode & 0xf000) === 0xa000)
    throw Error("Archive symlinks are not supported.");
  const normalized = name.endsWith("/") ? name.slice(0, -1) : name;
  relativeTarget(normalized);
  return normalized;
}
export async function extractZip(
  file: string,
  parent: string,
  relativeExecutable: string,
  validateTarget?: (file: string) => Promise<void>,
) {
  relativeTarget(relativeExecutable);
  parent = await realpath(parent);
  const id = randomUUID(),
    target = path.join(parent, "Ember-" + id),
    staging = target + ".partial";
  await mkdir(staging, { recursive: false });
  try {
    const free = await statfs(parent);
    const budget = Math.min(
      free.bavail * free.bsize - 64 * 1024 * 1024,
      100 * 1024 ** 3,
    );
    let total = 0,
      count = 0;
    const seen = new Set<string>();
    const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
      yauzl.open(
        file,
        { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
        (error, value) => (error || !value ? reject(error) : resolve(value)),
      ),
    );
    await new Promise<void>((resolve, reject) => {
      const fail = (e: unknown) => {
        zip.close();
        reject(e);
      };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        void (async () => {
          const mode = entry.externalFileAttributes >>> 16;
          const name = safeArchiveEntry(entry.fileName, mode);
          if (seen.has(name.toLowerCase()))
            throw Error("Duplicate archive path.");
          seen.add(name.toLowerCase());
          if (++count > 100000) throw Error("Too many archive entries.");
          total += entry.uncompressedSize;
          if (total > budget)
            throw Error(
              "Archive exceeds free disk space or the 100 GiB extraction limit.",
            );
          const output = path.join(staging, name);
          if (entry.fileName.endsWith("/"))
            await mkdir(output, { recursive: true });
          else {
            await mkdir(path.dirname(output), { recursive: true });
            const stream = await new Promise<NodeJS.ReadableStream>(
              (res, rej) =>
                zip.openReadStream(entry, (e, s) =>
                  e || !s ? rej(e) : res(s),
                ),
            );
            await pipeline(
              stream,
              createWriteStream(output, { flags: "wx", mode: 0o600 }),
            );
            if (mode & 0o111) await chmod(output, 0o700);
          }
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
    const executable = path.join(staging, relativeExecutable);
    const info = await stat(executable);
    if (!info.isFile() && !(info.isDirectory() && executable.endsWith(".app")))
      throw Error("Registered executable was not extracted.");
    await validateTarget?.(executable);
    await writeFile(
      path.join(staging, ".ember-install.json"),
      JSON.stringify({ id, target, relativeExecutable }),
      { flag: "wx" },
    );
    await rename(staging, target);
    return {
      directory: target,
      executable: path.join(target, relativeExecutable),
    };
  } catch (e) {
    await rm(staging, { recursive: true, force: true });
    throw e;
  }
}
export async function uninstallManaged(directory: string) {
  const actual = await realpath(directory);
  const marker = JSON.parse(
    await readFile(path.join(actual, ".ember-install.json"), "utf8"),
  );
  if (
    path.resolve(actual) !== path.resolve(directory) ||
    path.resolve(marker.target) !== path.resolve(directory) ||
    !/^Ember-[0-9a-f-]{36}$/.test(path.basename(actual)) ||
    path.basename(actual) !== "Ember-" + marker.id
  )
    throw Error(
      "Installation ownership marker does not match. No files deleted.",
    );
  await rm(actual, { recursive: true });
}
