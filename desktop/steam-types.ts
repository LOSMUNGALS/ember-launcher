import { readFile } from "node:fs/promises";
import path from "node:path";

// Read only common.type from bounded appinfo entries. Format reference:
// https://github.com/xPaw/SteamAppInfo (v39–41 file layout).
export function parseAppTypes(
  bytes: Buffer,
  wanted: Set<string>,
): Map<string, string> {
  const result = new Map<string, string>();
  if (bytes.length < 16) return result;
  const magic = bytes.readUInt32LE(0);
  if (![0x07564427, 0x07564428, 0x07564429].includes(magic)) return result;
  const indexed = magic === 0x07564429;
  const strings: string[] = [];
  let limit = bytes.length;
  if (indexed) {
    limit = Number(bytes.readBigUInt64LE(8));
    if (!Number.isSafeInteger(limit) || limit < 16 || limit + 4 > bytes.length)
      return result;
    const count = bytes.readUInt32LE(limit);
    let cursor = limit + 4;
    if (count > 1000000) return result;
    for (let i = 0; i < count; i++) {
      const end = bytes.indexOf(0, cursor);
      if (end < 0) return result;
      strings.push(bytes.toString("utf8", cursor, end));
      cursor = end + 1;
    }
  }
  for (let offset = indexed ? 16 : 8; offset + 8 <= limit;) {
    const id = bytes.readUInt32LE(offset);
    if (!id) break;
    const size = bytes.readUInt32LE(offset + 4),
      end = offset + 8 + size;
    if (end > limit || size < (magic === 0x07564427 ? 40 : 60)) break;
    if (wanted.has(String(id))) {
      let cursor = offset + (magic === 0x07564427 ? 48 : 68);
      const text = () => {
        const stop = bytes.indexOf(0, cursor);
        if (stop < 0 || stop >= end) throw Error("Invalid string");
        const value = bytes.toString("utf8", cursor, stop);
        cursor = stop + 1;
        return value;
      };
      const walk = (parents: string[], depth = 0): void => {
        if (depth > 30) throw Error("Invalid nesting");
        while (cursor < end) {
          const type = bytes[cursor++];
          if (type === 8 || type === 11) return;
          let key: string;
          if (indexed) {
            if (cursor + 4 > end) throw Error("Invalid key");
            key = strings[bytes.readUInt32LE(cursor)];
            cursor += 4;
            if (key === undefined) throw Error("Invalid key");
          } else key = text();
          if (type === 0) walk([...parents, key], depth + 1);
          else if (type === 1) {
            const value = text();
            if (key === "type" && parents.at(-1) === "common") {
              result.set(String(id), value.toLowerCase());
              throw Error("Found");
            }
          } else if ([2, 3, 4, 6].includes(type)) cursor += 4;
          else if ([7, 10].includes(type)) cursor += 8;
          else throw Error("Unsupported value");
          if (cursor > end) throw Error("Invalid value");
        }
      };
      try {
        walk([]);
      } catch {
        /* A malformed/unknown entry must not affect other records. */
      }
    }
    offset = end;
  }
  return result;
}
const nonGameIds = new Set(["228980", "1366800", "431960"]);
export function isPlayableEntry(game: {
  steamId?: string;
  name: string;
  productType?: string;
}): boolean {
  if (!game.steamId) return true;
  if (nonGameIds.has(game.steamId)) return false;
  if (game.productType)
    return ["game", "demo", "mod"].includes(game.productType.toLowerCase());
  return !/^(Steamworks Common Redistributables|Steam Linux Runtime.*|Proton(?: .*)?|SteamVR|Steamworks SDK|Dedicated Server)$/i.test(
    game.name,
  );
}
export async function readAppTypes(root: string, ids: Set<string>) {
  try {
    return parseAppTypes(
      await readFile(path.join(root, "appcache", "appinfo.vdf")),
      ids,
    );
  } catch {
    return new Map<string, string>();
  }
}
