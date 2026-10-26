import React, { useState, useRef } from "react";
import type { Game } from "./types";
export function SaveProtection({ games }: { games: Game[] }) {
  const [id, setId] = useState(""),
    [versions, setVersions] = useState<any[]>([]),
    [cloud, setCloud] = useState<any>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const selected = useRef("");
  const refresh = async (gameId: string) => {
    const result = await window.ember2.call("saveProtection", {
      id: gameId,
      mode: "list",
    });
    if (selected.current === gameId) setVersions(result.versions);
  };
  async function run(mode: string, version?: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await window.ember2.call("saveProtection", {
        id,
        mode,
        version,
        expectedRevision: cloud?.revision ?? 0,
      });
      if (mode === "cloudStatus") setCloud(r);
      setMessage(r?.message || "Finished.");
      if (mode === "upload") setCloud(undefined);
    } catch (e) {
      setMessage(String(e));
    } finally {
      await refresh(id).catch((e) => setMessage(String(e)));
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel">
      <h2>Save protection</h2>
      <p>
        Close your game before backing up or restoring. Select its actual
        save-data folder, not its installation folder. Every backup is a
        separate version; restoring preserves the current saves first.
      </p>
      <label>
        Game{" "}
        <select
          aria-label="Game"
          value={id}
          disabled={busy}
          onChange={(e) => {
            const value = e.target.value;
            selected.current = value;
            setId(value);
            setVersions([]);
            setCloud(undefined);
            setMessage("");
            if (value)
              void refresh(value).catch((e) => {
                if (selected.current === value) setMessage(String(e));
              });
          }}
        >
          <option value="">Choose a game</option>
          {games.map((g) => (
            <option value={g.id} key={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button disabled={busy || !id} onClick={() => void run("backup")}>
          Back up save folder…
        </button>
        <button disabled={busy || !id} onClick={() => void run("cloudStatus")}>
          Refresh cloud status
        </button>
        <button
          disabled={busy || !id || !cloud}
          onClick={() => void run("upload")}
        >
          {cloud?.revision
            ? "Replace cloud with local saves…"
            : "Upload local saves…"}
        </button>
        <button
          disabled={busy || !id || !cloud?.revision}
          onClick={() => void run("download")}
        >
          Download cloud as a new backup
        </button>
      </div>
      {cloud && (
        <p>
          {cloud.revision
            ? "Cloud revision " +
              cloud.revision +
              " · " +
              new Date(cloud.updated).toLocaleString()
            : "No cloud save yet."}
        </p>
      )}
      <p>
        Cloud transfers are manual: up to 2 MB and 1,000 files per game, 20
        games per account. Refresh status before uploading. A newer remote
        revision blocks stale uploads; choose deliberately which version to
        keep. Save data is stored on your hosted account service; select only
        the game’s saves.
      </p>
      <p role="status">{busy ? "Working…" : message}</p>
      {versions.map((v) => (
        <article key={v.id}>
          <span>
            {new Date(v.created).toLocaleString()} · {v.files} files{" "}
          </span>
          <button disabled={busy} onClick={() => void run("restore", v.id)}>
            Restore this version…
          </button>
        </article>
      ))}
      {id && !versions.length && <p>No versioned backups for this game yet.</p>}
    </section>
  );
}
