import React, { useState, useEffect } from "react";
import type { Game, SteamAchievement } from "./types";
export function AboutGame({ game }: { game: Game }) {
  const [expanded, setExpanded] = useState(false);
  const text =
    game.steam?.about ||
    game.description ||
    "Make this space yours. Add a description and launch options in Edit details.";
  return (
    <section className="about">
      <span className="eyebrow">ABOUT THIS GAME</span>
      <div>
        <p>
          {expanded || text.length <= 700 ? text : text.slice(0, 700) + "…"}
        </p>
        {text.length > 700 && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "Read full description"}
          </button>
        )}
        {game.steam?.about && (
          <small className="muted description-source">
            Source: official Steam store description ·{" "}
            {game.steam.aboutUpdated
              ? new Date(game.steam.aboutUpdated).toLocaleDateString()
              : ""}
          </small>
        )}
      </div>
    </section>
  );
}
export const playedSeconds = (g: Game) =>
  g.store === "steam" ? (g.steam?.playtimeMinutes ?? 0) * 60 : g.seconds;
export const deckLabel = (g: Game) =>
  g.steam?.deck
    ? {
        verified: "Verified",
        playable: "Playable",
        unsupported: "Unsupported",
        unknown: "Not rated",
      }[g.steam.deck]
    : "Unavailable";
export function AchievementIcon({
  achievement: a,
}: {
  achievement: SteamAchievement;
}) {
  const [failed, setFailed] = useState(false);
  return a.icon && !failed ? (
    <img
      className="achievement-icon"
      loading="lazy"
      src={a.icon}
      alt=""
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="achievement-icon fallback" aria-hidden="true">
      ♜
    </span>
  );
}
export function SteamDetails({ game: g }: { game: Game }) {
  const [limit, setLimit] = useState(24),
    [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const reload = async (force = false) => {
    setLoading(true);
    try { await window.ember2.call("achievements", { id: g.steamId, force }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload().catch(() => {}); }, [g.steamId]);
  const s = g.steam;
  const list = (s?.achievements || []).filter(
    (a) =>
      filter === "all" ||
      (filter === "unlocked" ? a.unlocked === true : a.unlocked === false),
  );
  const total = s?.achievementTotal,
    unlocked = s?.achievementUnlocked;
  return (
    <section className="panel steam-details">
      <div className="section-heading">
        <div>
          <span className="eyebrow">STEAM PROGRESS</span>
          <h2>Achievements</h2>
        </div>
        <strong>
          {unlocked !== undefined && total !== undefined
            ? `${unlocked} / ${total} unlocked`
            : total !== undefined ? `${total} achievements` : "Not available yet"}
        </strong>
      </div>
      {total !== undefined && unlocked !== undefined && total > 0 && (
        <progress
          aria-label="Steam achievement completion"
          max={total}
          value={Math.min(unlocked, total)}
        />
      )}
      <p className="muted">{s?.achievementMessage || "Loading Steam achievement details…"}</p>
      <button disabled={loading} onClick={() => void reload(true).catch(() => {})}>{loading ? "Loading achievements…" : "Refresh achievements"}</button>
      {total === 0 ? (
        <p>Steam reports no achievements.</p>
      ) : (
        <>
          <label className="achievement-filter">
            Show achievements{" "}
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(24);
              }}
            >
              <option value="all">All achievements</option>
              <option value="unlocked">Unlocked</option>
              <option value="locked">Locked</option>
            </select>
          </label>
          <div className="achievement-grid">
            {list.slice(0, limit).map((a) => (
              <article
                className={`achievement ${a.unlocked === false ? "locked" : ""}`}
                key={a.id}
              >
                <AchievementIcon achievement={a} />
                <div>
                  <strong>
                    {a.hidden && !a.unlocked ? "Hidden achievement" : a.name}
                  </strong>
                  <p>
                    {a.hidden && !a.unlocked
                      ? "Keep playing to discover this achievement."
                      : a.description}
                  </p>
                  <small>
                    {a.unlocked === true
                      ? "Unlocked"
                      : a.unlocked === false
                        ? "Locked"
                        : "Unlock state unavailable"}
                    {a.unlocked && a.unlockedAt
                      ? ` · ${new Date(a.unlockedAt * 1000).toLocaleDateString()}`
                      : ""}
                  </small>
                </div>
              </article>
            ))}
          </div>
          {!list.length && (
            <p>No matching achievement details available.</p>
          )}
          {list.length > limit && (
            <button onClick={() => setLimit(limit + 48)}>
              Show more achievements
            </button>
          )}
          <p className="muted">
            {s?.achievements?.length ?? 0} achievement details
            {total !== undefined ? ` of ${total} total` : ""}. Missing entries
            are not counted as locked.
          </p>
        </>
      )}
      {s?.errors?.map((e) => (
        <p className="muted" key={e}>
          {e}
        </p>
      ))}
    </section>
  );
}
export function DashboardSummary({
  games,
  onSelect,
}: {
  games: Game[];
  onSelect: (id: string) => void;
}) {
  const steam = games.filter((g) => g.store === "steam");
  if (!steam.length) return null;
  const hours = (
    games.reduce((n, g) => n + playedSeconds(g), 0) / 3600
  ).toFixed(1);
  const unlocked = steam.reduce(
    (n, g) => n + (g.steam?.achievementUnlocked ?? 0),
    0,
  );
  const recent = steam
    .flatMap((g) =>
      (g.steam?.achievements || [])
        .filter((a) => a.unlocked)
        .map((a) => ({ g, a })),
    )
    .sort((x, y) => (y.a.unlockedAt || 0) - (x.a.unlockedAt || 0))
    .slice(0, 6);
  return (
    <section className="dashboard-overview">
      <div className="stats">
        <div>
          <span className="eyebrow">IMPORTED + LOCAL PLAYTIME</span>
          <strong>{hours}h</strong>
          <small>
            {steam.filter((g) => g.steam?.playtimeMinutes !== undefined).length}
            /{steam.length} Steam games with cached time
          </small>
        </div>
        <div>
          <span className="eyebrow">ACHIEVEMENTS UNLOCKED</span>
          <strong>{unlocked}</strong>
          <small>From available Steam cache</small>
        </div>
        <div>
          <span className="eyebrow">STEAM DECK VERIFIED</span>
          <strong>
            {steam.filter((g) => g.steam?.deck === "verified").length}
          </strong>
          <small>Valve rating · not Mac compatibility</small>
        </div>
      </div>
      {recent.length > 0 && (
        <>
          <h2>Recent achievements</h2>
          <div className="recent-achievements">
            {recent.map(({ g, a }) => (
              <button key={g.id + ":" + a.id} onClick={() => onSelect(g.id)}>
                <AchievementIcon achievement={a} />
                <span>
                  <strong>{a.name}</strong>
                  <small>{g.name}</small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
