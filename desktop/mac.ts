import { stat, readdir, open } from "node:fs/promises";
import path from "node:path";
export async function nativeMacTarget(
  file: string,
  depth = 0,
  allowIntel = true,
): Promise<boolean> {
  if (depth > 5) return false;
  const info = await stat(file).catch(() => null);
  if (!info) return false;
  if (info.isDirectory()) {
    const root = file.endsWith(".app")
      ? path.join(file, "Contents/MacOS")
      : file;
    const entries = await readdir(root, { withFileTypes: true }).catch(
      () => [],
    );
    for (const entry of entries.slice(0, 100))
      if (
        !entry.isSymbolicLink() &&
        (await nativeMacTarget(
          path.join(root, entry.name),
          depth + 1,
          allowIntel,
        ))
      )
        return true;
    return false;
  }
  const handle = await open(file, "r");
  try {
    const bytes = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const arch = macBinaryArchitecture(bytes.subarray(0, bytesRead));
    return arch === "arm64" || (arch === "x64" && allowIntel);
  } finally {
    await handle.close();
  }
}
export function macBinaryArchitecture(
  bytes: Buffer,
): "arm64" | "x64" | "unknown" {
  if (bytes.length < 8) return "unknown";
  const magic = bytes.subarray(0, 4).toString("hex");
  const cpu = (type: number) =>
    type === 0x0100000c ? "arm64" : type === 0x01000007 ? "x64" : "unknown";
  if (magic === "cffaedfe") return cpu(bytes.readUInt32LE(4));
  if (magic === "feedfacf") return cpu(bytes.readUInt32BE(4));
  if (!["cafebabe", "bebafeca", "cafebabf", "bfbafeca"].includes(magic))
    return "unknown";
  const little = magic === "bebafeca" || magic === "bfbafeca";
  const read = (offset: number) =>
    little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
  const count = read(4),
    stride = magic === "cafebabf" || magic === "bfbafeca" ? 32 : 20;
  if (count < 1 || count > 64 || 8 + count * stride > bytes.length)
    return "unknown";
  let result: "arm64" | "x64" | "unknown" = "unknown";
  for (let i = 0; i < count; i++) {
    const arch = cpu(read(8 + i * stride));
    if (arch === "arm64") return arch;
    if (arch === "x64") result = arch;
  }
  return result;
}
