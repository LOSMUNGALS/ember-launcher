import React, { useEffect, useRef, useState } from "react";
export function GameRepair({
  id,
  name,
  onClose,
}: {
  id: string;
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [health, setHealth] = useState<{
      executable: string;
      launchMethod?: string;
      exists: boolean;
      ready: boolean;
      issues: string[];
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      setHealth(await window.ember2.call("repairGame", { id, action }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    dialog.current?.showModal();
    void run("diagnose");
  }, [id]);
  return (
    <dialog
      ref={dialog}
      className="launcher-update-dialog game-repair"
      aria-label="Fix this game"
      onCancel={onClose}
    >
      <header>
        <div>
          <p className="eyebrow">LAUNCH REPAIR</p>
          <h2>{name}</h2>
        </div>
        <button onClick={onClose} aria-label="Close launch repair">
          ✕
        </button>
      </header>
      <p>
        Check the installed executable or reconnect a game that moved. These
        actions do not reinstall or delete game files.
      </p>
      {health && (
        <>
          <p>
            {health.launchMethod === "steam"
              ? "Steam installation folder:"
              : "Registered executable:"}{" "}
            <code>{health.executable || "Not set"}</code>
          </p>
          {health.ready ? (
            <p role="status">
              {health.launchMethod === "steam"
                ? "Steam installation folder found. Steam manages the game executable; you can try Play."
                : "Executable found and passed the platform checks. You can try Play."}
            </p>
          ) : (
            <ul>
              {health.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button disabled={busy} onClick={() => void run("diagnose")}>
          Check again
        </button>
        <button disabled={busy} onClick={() => void run("rescan")}>
          Rescan installation
        </button>
        <button
          disabled={busy || health?.launchMethod === "steam"}
          onClick={() => void run("choose")}
        >
          Choose executable
        </button>
        <button
          disabled={!health?.exists || busy}
          onClick={() =>
            void window.ember2
              .call("reveal", { id })
              .catch((e) => setError(String(e)))
          }
        >
          Open folder
        </button>
      </div>
      {busy && <p role="status">Checking installation…</p>}
    </dialog>
  );
}
