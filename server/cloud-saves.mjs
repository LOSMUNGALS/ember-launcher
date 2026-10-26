import { createHash } from "node:crypto";
export const SAVE_LIMIT = 2 * 1024 * 1024;
export function validateSave(p) {
  if (
    !p ||
    typeof p.key !== "string" ||
    !/^[\w-]{1,220}$/.test(p.key) ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 200 ||
    !Array.isArray(p.files) ||
    !p.files.length ||
    p.files.length > 1000
  )
    throw Error("Invalid save snapshot (1–1,000 files required).");
  let total = 0;
  const paths = new Set();
  const files = p.files.map((f) => {
    if (
      !f ||
      typeof f.path !== "string" ||
      f.path.length > 240 ||
      f.path
        .split("/")
        .some(
          (c) =>
            !c ||
            c === "." ||
            c === ".." ||
            /[<>:"\\|?*\x00-\x1f]/.test(c) ||
            /[. ]$/.test(c) ||
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(c),
        ) ||
      paths.has(f.path.toLowerCase())
    )
      throw Error("Unsafe or duplicate save filename.");
    paths.add(f.path.toLowerCase());
    if (
      typeof f.data !== "string" ||
      f.data.length > SAVE_LIMIT * 1.4 ||
      /[^A-Za-z0-9+/=]/.test(f.data)
    )
      throw Error("Invalid save data.");
    const bytes = Buffer.from(f.data, "base64");
    if (bytes.toString("base64") !== f.data)
      throw Error("Invalid save encoding.");
    total += bytes.length;
    if (total > SAVE_LIMIT)
      throw Error(
        "Cloud saves support up to 2 MB per game. Keep larger snapshots locally.",
      );
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (f.sha256 !== sha256) throw Error("Save integrity check failed.");
    return { path: f.path, data: f.data, sha256 };
  });
  for (const f of files) {
    const pieces = f.path.toLowerCase().split("/");
    while (pieces.length > 1) {
      pieces.pop();
      if (paths.has(pieces.join("/"))) throw Error("Conflicting save paths.");
    }
  }
  return { key: p.key, name: p.name.trim(), files };
}
