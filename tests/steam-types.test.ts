import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAppTypes, isPlayableEntry } from "../desktop/steam-types";
import { bannerColor } from "../desktop/artwork";

function fixture(version: number, indexed: boolean) {
  const header = Buffer.alloc(indexed ? 16 : 8);
  header.writeUInt32LE(version);
  const text = (value: string) => Buffer.from(value + "\0");
  const key = (name: string, index: number) => {
    if (!indexed) return text(name);
    const result = Buffer.alloc(4);
    result.writeUInt32LE(index);
    return result;
  };
  const entries = ["game", "application", "tool"].map((type, index) => {
    const body = Buffer.concat([
      Buffer.from([0]),
      key("common", 0),
      Buffer.from([1]),
      key("type", 1),
      text(type),
      Buffer.from([8, 8]),
    ]);
    const fixed = Buffer.alloc(version === 0x07564427 ? 48 : 68);
    fixed.writeUInt32LE(100 + index);
    fixed.writeUInt32LE(fixed.length - 8 + body.length, 4);
    return Buffer.concat([fixed, body]);
  });
  const data = Buffer.concat([header, ...entries, Buffer.alloc(4)]);
  if (!indexed) return data;
  data.writeBigUInt64LE(BigInt(data.length), 8);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(2);
  return Buffer.concat([data, count, text("common"), text("type")]);
}
for (const version of [0x07564427, 0x07564428, 0x07564429]) {
  test(`Steam type parser handles version ${version.toString(16)}`, () => {
    const result = parseAppTypes(
      fixture(version, version === 0x07564429),
      new Set(["100", "101", "102"]),
    );
    assert.deepEqual([...result.values()], ["game", "application", "tool"]);
  });
}
test("only playable product types survive classification; known utilities stay hidden without metadata", () => {
  for (const type of ["application", "tool", "dlc", "video", "music"])
    assert.equal(
      isPlayableEntry({ steamId: "123", name: "Product", productType: type }),
      false,
    );
  for (const id of ["228980", "1366800", "431960"])
    assert.equal(isPlayableEntry({ steamId: id, name: "Utility" }), false);
  assert.equal(
    isPlayableEntry({ steamId: "123", name: "Game", productType: "game" }),
    true,
  );
  assert.equal(parseAppTypes(Buffer.from("invalid"), new Set(["123"])).size, 0);
});
test("banner color keeps the image hue while limiting brightness for readable white text", () => {
  assert.equal(
    bannerColor(Buffer.from([0, 0, 200, 255, 0, 0, 200, 255])),
    "#640000",
  );
  assert.equal(bannerColor(Buffer.alloc(4)), "#263338");
});
