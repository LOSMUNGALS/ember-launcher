import React, { useState, useEffect } from "react";
export function DisplayPreferences() {
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void window.ember2
        .call("displaySettings")
        .then((p) => {
          if (!active) return;
          document.documentElement.dataset.motion = p.reduceMotion
            ? "reduced"
            : "";
          document.documentElement.dataset.contrast = p.highContrast
            ? "high"
            : "";
        })
        .catch(() => {});
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
    [message, setMessage] = useState("");
  useEffect(() => {
    void window.ember2.call("displaySettings").then(setP);
  }, []);
  async function change(key: string, value: boolean) {
    try {
      const result = await window.ember2.call("personalization", {
        ...p,
        [key]: value,
      });
      setP(result);
      setMessage("Saved.");
    } catch (e) {
      setMessage(String(e));
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
