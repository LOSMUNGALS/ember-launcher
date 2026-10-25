import React, { useEffect, useRef, useState } from "react";
import type { Game } from "./types";
import "./library-tools.css";
const size = (n?: number) =>
  n === undefined
    ? "Unknown"
    : n >= 1024 ** 3
      ? (n / 1024 ** 3).toFixed(1) + " GB"
      : (n / 1024 ** 2).toFixed(1) + " MB";
export function GameManagement({
  game,
  onClose,
}: {
  game: Game;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [collections, setCollections] = useState(
      (game.collections || []).join(", "),
    ),
    [favorite, setFavorite] = useState(!!game.favorite),
    [hidden, setHidden] = useState(!!game.hidden),
    [status, setStatus] = useState(game.playStatus || "backlog"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      if (modal?.open) modal.close();
    };
  }, []);
  const art = async (action: string) => {
    setBusy(true);
    try {
      await window.ember2.call("gameArtwork", { id: game.id, action });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="launcher-update-dialog library-management"
      aria-label="Manage game"
      onCancel={onClose}
    >
      <header>
        <h2>{game.name}</h2>
        <button onClick={onClose} aria-label="Close game management">
          ✕
        </button>
      </header>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await window.ember2.call("organizeGame", {
              id: game.id,
              collections: collections.split(","),
              favorite,
              hidden,
              playStatus: status,
            });
            onClose();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Collections (separate with commas)
          <input
            aria-label="Game collections"
            value={collections}
            maxLength={1000}
            onChange={(e) => setCollections(e.target.value)}
          />
        </label>
        <label>
          Play status
          <select
            aria-label="Game play status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="backlog">Backlog</option>
            <option value="playing">Playing</option>
            <option value="finished">Finished</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />{" "}
          Favorite
        </label>
        <label>
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
          />{" "}
          Hide from discovery and the default library view
        </label>
        <div className="actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void art("choose")}
          >
            Choose cover image
          </button>
          <button
            type="button"
            disabled={busy || !game.customArtwork}
            onClick={() => void art("reset")}
          >
            Reset cover
          </button>
          <button className="primary" disabled={busy}>
            Save game preferences
          </button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
    </dialog>
  );
}
type StorageRow = {
  id: string;
  name: string;
  directory: string;
  bytes?: number;
  free?: number;
  movable: boolean;
  error?: string;
  store: string;
};
export function StorageManager() {
  const [rows, setRows] = useState<StorageRow[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      setRows((await window.ember2.call("storage")).games);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const run = async (
    action: "moveGame" | "backupSaves" | "uninstall",
    id: string,
  ) => {
    setBusy(true);
    setError("");
    try {
      const result = await window.ember2.call(action, { id });
      if (result?.warning) setMessage(result.warning);
      else if (result?.directory) setMessage("Saved to " + result.directory);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-panel storage-manager">
      <h2>Storage manager</h2>
      <p>
        Inspect installed sizes and free space. Ember-owned archive
        installations can move to another folder or drive. Use the original
        installer to move Steam or externally installed games.
      </p>
      <button disabled={busy} onClick={() => void refresh()}>
        {busy ? "Working…" : rows ? "Refresh storage" : "Scan installed games"}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {rows?.length === 0 && <p>No installed games found.</p>}
      {rows?.map((row) => (
        <article key={row.id} className="storage-row">
          <h3>{row.name}</h3>
          <p>
            {size(row.bytes)} installed · {size(row.free)} free on this drive
          </p>
          <code>{row.directory}</code>
          {row.error && <p>{row.error}</p>}
          <div className="actions">
            <button
              disabled={busy}
              onClick={() =>
                void window.ember2
                  .call("reveal", { id: row.id })
                  .catch((e) => setError(String(e)))
              }
            >
              Open folder
            </button>
            {row.movable && (
              <button
                disabled={busy}
                onClick={() => void run("moveGame", row.id)}
              >
                Move to another drive
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => void run("backupSaves", row.id)}
            >
              Back up save folder…
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const backup = await window.ember2.call("backupSaves", {
                    id: row.id,
                  });
                  if (!backup) {
                    setBusy(false);
                    return;
                  }
                  await run("uninstall", row.id);
                } catch (e) {
                  setError(String(e));
                  setBusy(false);
                }
              }}
            >
              Back up saves, then uninstall…
            </button>
            <button
              disabled={busy}
              onClick={() => void run("uninstall", row.id)}
            >
              Uninstall…
            </button>
          </div>
          <small>
            Save locations differ by game. Choose the actual save-data folder
            when backing up. Files inside an installation folder may be removed
            by its uninstaller; backups are stored separately in Ember's
            save-backups folder.
          </small>
        </article>
      ))}
    </section>
  );
}
