import React, { useRef, useState, useEffect } from "react";
export function ScreenshotGallery({ images }: { images: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [index, setIndex] = useState(0), [closing, setClosing] = useState(false);
  const [failed, setFailed] = useState(false), [direction, setDirection] = useState(1);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => { dialog.current?.close(); setClosing(false); }, 180);
  };
  const move = (step: number) => { setDirection(step); setFailed(false); setIndex(i => (i + step + images.length) % images.length); };
  return <section><h2>Screenshots</h2><div className="screenshots">
    {images.map((src, i) => <button className="screenshot-thumb" key={src} aria-label={`Open screenshot ${i + 1}`} onClick={() => { setIndex(i); setFailed(false); dialog.current?.showModal(); }}><img loading="lazy" src={src} alt={`Game screenshot ${i + 1}`} /></button>)}
  </div><dialog ref={dialog} className={`screenshot-viewer ${closing ? "closing" : ""}`} aria-label="Screenshot gallery" onCancel={e => { e.preventDefault(); close(); }} onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); move(e.key === "ArrowRight" ? 1 : -1); } }}>
    <button className="viewer-close" autoFocus onClick={close} aria-label="Close screenshots">✕</button>
    <button className="viewer-prev" disabled={images.length < 2} onClick={() => move(-1)} aria-label="Previous screenshot">‹</button>
    <div key={index} className={`viewer-frame ${direction < 0 ? "backwards" : ""}`}>
      {failed ? <p>Screenshot unavailable. Try the next image.</p> : <img src={images[index]} alt={`Screenshot ${index + 1} of ${images.length}`} onError={() => setFailed(true)} />}
    </div>
    <button className="viewer-next" disabled={images.length < 2} onClick={() => move(1)} aria-label="Next screenshot">›</button>
    <p className="viewer-count" aria-live="polite">{index + 1} / {images.length}</p>
  </dialog></section>;
}
