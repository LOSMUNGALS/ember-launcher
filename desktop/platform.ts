import path from "node:path";
import { stat, open } from "node:fs/promises";
export async function windowsExecutable(file: string) {
  const handle = await open(file, "r");
  try {
    const header = Buffer.alloc(64);
    if (
      (await handle.read(header, 0, 64, 0)).bytesRead !== 64 ||
      header.toString("ascii", 0, 2) !== "MZ"
    )
      return false;
    const offset = header.readUInt32LE(60);
    if (offset < 64 || offset > 16 * 1024 * 1024) return false;
    const pe = Buffer.alloc(24);
    if ((await handle.read(pe, 0, 24, offset)).bytesRead !== 24) return false;
    return (
      pe.readUInt32LE(0) === 0x4550 &&
      Boolean(pe.readUInt16LE(22) & 2) &&
      !(pe.readUInt16LE(22) & 0x2000)
    );
  } finally {
    await handle.close();
  }
}
import type { Game, Settings } from "../src/types";
export function launchPlan(
  game: Game,
  _settings: Settings,
  platform: string,
): { command: string; args: string[]; env: Record<string, string> } {
  if (!["win32", "darwin"].includes(platform))
    throw Error("This build targets Windows and macOS.");
  if (
    platform === "darwin" &&
    (game.platform === "windows" ||
      /\.(exe|msi|bat|cmd)$/i.test(game.executable))
  )
    throw Error(
      "Windows games cannot run on macOS. Ember 2 supports native Mac games only.",
    );
  if (platform === "darwin" && game.executable.endsWith(".app"))
    return {
      command: "/usr/bin/open",
      args: ["-W", "-a", game.executable, "--args", ...game.args],
      env: {},
    };
  if (platform === "win32" && !game.executable.toLowerCase().endsWith(".exe"))
    throw Error(
      "Choose a Windows .exe executable. Shell scripts and shortcuts are not supported.",
    );
  return { command: game.executable, args: game.args, env: {} };
}
export async function checkTarget(target: string) {
  if (!path.isAbsolute(target))
    throw Error("Executable path must be absolute.");
  await stat(target).catch(() => {
    throw Error("File not found: " + target);
  });
}
