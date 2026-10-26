import React, { useState, useEffect, useRef } from "react";
export function DisplayPreferences() {
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const request = ++generation;
      return void window.ember2
        .call("displaySettings")
        .then((p) => {
          if (!active || request !== generation) return;
          document.documentElement.dataset.motion = p.reduceMotion
            ? "reduced"
            : "";
          document.documentElement.dataset.contrast = p.highContrast
            ? "high"
            : "";
        })
        .catch(() => {});
    };
    refresh();
    const off = window.ember2.subscribe(refresh);
    return () => {
      active = false;
      off();
    };
  }, []);
  return null;
}
export function Personalization() {
  const [p, setP] = useState<any>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true,
      generation = 0;
    const refresh = () => {
      const request = ++generation;
      void window.ember2
        .call("displaySettings")
        .then((result) => {
          if (active && request === generation && !saving.current) {
            setP(result);
            setLoaded(true);
          }
        })
        .catch((e) => {
          if (active && request === generation) setMessage(String(e));
        });
    };
    refresh();
    const off = window.ember2.subscribe(refresh);
    return () => {
      active = false;
      off();
    };
  }, []);
  async function change(key: string, value: boolean) {
    if (!loaded || saving.current) return;
    const previous = p,
      next = { ...p, [key]: value };
    saving.current = true;
    setP(next);
    setBusy(true);
    try {
      const result = await window.ember2.call("personalization", {
        ...p,
        [key]: value,
      });
      setP(result);
      setMessage("Saved.");
    } catch (e) {
      setP(previous);
      setMessage(String(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel">
      <h2>Notifications & accessibility</h2>
      {[
        ["notifyDownloads", "Desktop notifications for completed downloads"],
        ["notifyErrors", "Desktop notifications for failed downloads"],
        ["announcementBadge", "Unread announcement badge"],
        ["reduceMotion", "Reduce motion"],
        ["highContrast", "High contrast"],
      ].map(([key, label]) => (
        <label key={key} style={{ display: "block", margin: "14px 0" }}>
          <input
            type="checkbox"
            disabled={busy || !loaded}
            checked={
              key === "announcementBadge" ? p[key] !== false : p[key] === true
            }
            onChange={(e) => void change(key, e.target.checked)}
          />{" "}
          {label}
        </label>
      ))}
      <p>
        Ctrl + mouse wheel zooms. Ctrl + middle-click resets to the normal size
        for this monitor. Zoom is remembered on this device.
      </p>
      <p role="status">{message}</p>
    </section>
  );
}
