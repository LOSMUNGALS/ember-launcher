import {
  readdir,
  lstat,
  realpath,
  statfs,
  mkdir,
  copyFile,
  rm,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { hashFile } from "./downloads";
export async function folderInventory(directory: string) {
  const root = await realpath(directory);
  if ((await lstat(directory)).isSymbolicLink())
    throw Error("Linked folders cannot be managed.");
  const files: { relative: string; size: number }[] = [],
    directories: string[] = [];
  let bytes = 0;
  const walk = async (current: string) => {
    for (const item of await readdir(current, { withFileTypes: true })) {
      const file = path.join(current, item.name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink())
        throw Error(
          "This folder contains links. Manage it using the original installer.",
        );
      if (stat.isDirectory()) {
        directories.push(path.relative(root, file));
        if (directories.length > 100000) throw Error("Too many directories.");
        await walk(file);
      } else if (stat.isFile()) {
        files.push({ relative: path.relative(root, file), size: stat.size });
        bytes += stat.size;
        if (files.length > 100000 || bytes > 1024 ** 4)
          throw Error("Folder exceeds the supported scan size.");
      }
    }
  };
  await walk(root);
  return { root, files, directories, bytes };
}
export async function verifiedFolderCopy(source: string, target: string) {
  const inventory = await folderInventory(source),
    parent = await realpath(path.dirname(target));
  target = path.join(parent, path.basename(target));
  const relative = path.relative(inventory.root, parent);
  if (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  )
    throw Error("Choose a destination outside the source folder.");
  const disk = await statfs(parent);
  if (disk.bavail * disk.bsize < inventory.bytes + 64 * 1024 * 1024)
    throw Error("Not enough free disk space at the destination.");
  await mkdir(target); // No overwrite: a pre-existing target is an error.
  try {
    for (const directory of inventory.directories)
      await mkdir(path.join(target, directory), { recursive: true });
    for (const file of inventory.files) {
      const origin = path.join(inventory.root, file.relative),
        destination = path.join(target, file.relative);
      if ((await lstat(origin)).isSymbolicLink())
        throw Error("Source changed during copying.");
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(origin, destination);
      if ((await hashFile(origin)) !== (await hashFile(destination)))
        throw Error(
          "Copied file verification failed. Original files are preserved.",
        );
    }
    return inventory;
  } catch (e) {
    const resolved = path.resolve(target);
    if (path.dirname(resolved) !== parent) throw e;
    await rm(resolved, { recursive: true, force: true });
    throw e;
  }
}
export async function managedMoveSource(directory: string, executable: string) {
  const actual = await realpath(directory),
    marker = JSON.parse(
      await readFile(path.join(actual, ".ember-install.json"), "utf8"),
    );
  if (
    (await lstat(directory)).isSymbolicLink() ||
    (await realpath(marker.target)) !== actual ||
    path.basename(actual) !== "Ember-" + marker.id ||
    !/^Ember-[a-f0-9-]{36}$/.test(path.basename(actual))
  )
    throw Error("Only Ember-owned archive installations can be moved here.");
  const relative = path.relative(actual, await realpath(executable));
  if (
    !relative ||
    relative.startsWith(".." + path.sep) ||
    relative === ".." ||
    path.isAbsolute(relative)
  )
    throw Error("Executable is outside the managed installation.");
  return { actual, marker, relative };
}
export async function retargetMoveMarker(directory: string, target: string) {
  const file = path.join(directory, ".ember-install.json"),
    marker = JSON.parse(await readFile(file, "utf8"));
  await writeFile(file, JSON.stringify({ ...marker, target }), { mode: 0o600 });
}
