import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localPlaytimes,
  parseVdf,
  cachedDetails,
  plainText,
  iconUrl,
  deckCategory,
  publicDashboard,
  validateSteamDashboard,
} from "../desktop/steam-dashboard";
test("Steam playtime parser isolates apps, preserves zero, and rejects malformed data", () => {
  const value = localPlaytimes(
    '"UserLocalConfigStore" { "Software" { "Valve" { "Steam" { "apps" { "1" { "Playtime" "0" "LastPlayed" "123" } "2" { "cloud" { "Playtime" "999" } "Playtime" "57" } "3" { "Playtime" "bad" } } } } } }',
  );
  assert.equal(value["1"].minutes, 0);
  assert.equal(value["2"].minutes, 57);
  assert.equal(value["3"].minutes, undefined);
  assert.equal(value["1"].lastPlayed, 123);
  assert.throws(() => parseVdf('"a" { "b" "c"'));
  const proto = parseVdf('"__proto__" { "polluted" "yes" }');
  assert.equal(Object.getPrototypeOf(proto), null);
  assert.equal(({} as any).polluted, undefined);
});
test("cached achievements deduplicate IDs and preserve missing unlock state", () => {
  const r = cachedDetails([
    [
      "achievements",
      {
        data: {
          nTotal: 10,
          nAchieved: 3,
          vecUnachieved: [
            {
              strID: "a",
              strName: "First",
              strImage: "https://evil.example/a.png",
              bAchieved: false,
            },
          ],
          vecHighlight: [
            { strID: "a", strName: "First", bAchieved: true, rtUnlocked: 123 },
            { strID: "b", strName: "Unknown" },
          ],
        },
      },
    ],
    [
      "descriptions",
      { data: { strFullDescription: "<p>Official &amp; safe</p>" } },
    ],
  ]);
  assert.equal(r.achievements?.length, 2);
  assert.equal(r.achievements?.[0].unlocked, true);
  assert.equal(r.achievements?.[1].unlocked, undefined);
  assert.equal(r.achievementTotal, 10);
  assert.equal(r.about, "Official & safe");
  validateSteamDashboard(r);
});
test("description conversion removes markup and scripts; icons stay on approved HTTPS hosts", () => {
  assert.equal(
    plainText(
      '[b]Adventure[/b][list][*]Explore[/list][img]https://image.test/a.jpg[/img][imgvid webm="url"][/imgvid]',
    ),
    "Adventure\n• Explore",
  );
  assert.equal(
    plainText("<script>alert(1)</script><p>A &amp; B</p><p>&#x1f3ae;</p>"),
    "A & B\n🎮",
  );
  assert.equal(
    iconUrl("https://shared.steamstatic.com/community_assets/a.jpg"),
    "https://shared.steamstatic.com/community_assets/a.jpg",
  );
  for (const url of [
    "http://shared.steamstatic.com/a",
    "https://shared.steamstatic.com.evil.test/a",
    "file:///etc/passwd",
    "https://user@shared.steamstatic.com/a",
  ])
    assert.equal(iconUrl(url), undefined);
  assert.throws(() =>
    validateSteamDashboard({
      achievements: [
        { id: "x", name: "x", description: "", icon: "https://evil.test/x" },
      ],
    }),
  );
});
test("Deck response distinguishes Valve categories and refuses mismatched app IDs", () => {
  for (const [n, name] of [
    "unknown",
    "unsupported",
    "playable",
    "verified",
  ].entries())
    assert.equal(
      deckCategory(
        { success: 1, results: { appid: 620, resolved_category: n } },
        "620",
      ),
      name,
    );
  assert.throws(() =>
    deckCategory(
      { success: 1, results: { appid: 42, resolved_category: 3 } },
      "620",
    ),
  );
  assert.throws(() =>
    deckCategory(
      { success: 1, results: { appid: 620, resolved_category: 8 } },
      "620",
    ),
  );
});
test("public metadata caches successes for 24h and preserves offline values", async () => {
  let requests = 0;
  const get = async (url: string) => {
    requests++;
    return url.includes("appdetails")
      ? {
          "620": {
            success: true,
            data: { about_the_game: "<p>Portal adventure.</p>" },
          },
        }
      : { success: 1, results: { appid: 620, resolved_category: 3 } };
  };
  const fresh = await publicDashboard(
    "620",
    { playtimeMinutes: 24 },
    false,
    get,
  );
  assert.equal(fresh.about, "Portal adventure.");
  assert.equal(fresh.deck, "verified");
  assert.equal(fresh.playtimeMinutes, 24);
  assert.equal(requests, 2);
  validateSteamDashboard(fresh);
  await publicDashboard("620", fresh, false, get);
  assert.equal(requests, 2);
  const offline = await publicDashboard("620", fresh, true, async () => {
    throw Error("offline");
  });
  assert.equal(offline.about, fresh.about);
  assert.equal(offline.deck, "verified");
  assert.equal(offline.deckUpdated, fresh.deckUpdated);
  assert.equal(offline.errors?.length, 2);
});
test("private/unavailable data is not represented as zero achievements or Unsupported", async () => {
  const r = await publicDashboard("620", {}, true, async () => ({
    success: 0,
  }));
  assert.equal(r.deck, undefined);
  assert.equal(r.achievementUnlocked, undefined);
  assert.equal(r.playtimeMinutes, undefined);
});
