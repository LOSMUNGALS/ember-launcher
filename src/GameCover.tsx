import React, { useState } from "react";
export function GameCover({
  sources,
  title,
}: {
  sources: (string | undefined)[];
  title: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = sources.find((s) => s && !failed.includes(s));
  return source ? (
    <img
      loading="lazy"
      decoding="async"
      src={source}
      alt=""
      onError={() => setFailed((old) => [...old, source])}
    />
  ) : (
    <span
      className="cover-fallback"
      aria-label={"Artwork unavailable for " + title}
    >
      {title}
    </span>
  );
}
