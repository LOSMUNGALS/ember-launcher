import React, { useCallback, useEffect, useRef, useState } from "react";
import type { V2Action } from "./v2types";
import "./feedback.css";
const labels = ["Open", "In the Works", "Not Happening", "Done/Fixed"];
type Post = {
  id: number;
  title: string;
  body: string;
  authorName: string;
  label: string;
  created: number;
  messageCount: number;
  imageId?: number;
};
type Message = {
  id: number;
  body: string;
  authorName: string;
  role: string;
  created: number;
  images: number[];
};
type Thread = { post: Post; canReply: boolean; messages: Message[] };
const api = (action: V2Action, p?: unknown) => window.ember2.call(action, p);
function FeedbackImage({ id }: { id: number }) {
  const [data, setData] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    setData("");
    setError(false);
    void api("feedbackImage", { id })
      .then((r) => {
        if (live) setData(r.data);
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [id]);
  return error ? (
    <small>Image unavailable</small>
  ) : data ? (
    <img
      src={data}
      alt="Feedback attachment"
      loading="lazy"
      onError={() => setError(true)}
    />
  ) : (
    <small>Loading image…</small>
  );
}
async function imageData(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Use PNG, JPEG, WebP or GIF images up to 10 MB each.");
  let blob: Blob = file;
  if (file.size > 512 * 1024) {
    if (file.type === "image/gif") throw Error("GIFs must be at most 512 KB.");
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 40000000)
        throw Error("Image dimensions are too large.");
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.65, 0.4]) {
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(Error("Could not resize image.")),
            "image/webp",
            quality,
          ),
        );
        if (blob.size <= 512 * 1024) break;
      }
      if (blob.size > 512 * 1024)
        throw Error(
          "This image is too large after resizing. Please use a smaller image.",
        );
    } finally {
      bitmap.close();
    }
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}
function Composer({
  onSend,
  titleRequired = false,
}: {
  onSend: (body: string, images: string[], title: string) => Promise<void>;
  titleRequired?: boolean;
}) {
  const [body, setBody] = useState(""),
    [title, setTitle] = useState(""),
    [images, setImages] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attaching, setAttaching] = useState(false);
  const adding = useRef(false);
  const attach = async (files: File[]) => {
    if (adding.current || busy) return;
    adding.current = true;
    setAttaching(true);
    setError("");
    try {
      if (images.length + files.length > 3)
        throw Error("Attach up to three images.");
      const added = await Promise.all(files.map(imageData));
      setImages((old) => [...old, ...added]);
    } catch (e) {
      setError(String(e));
    } finally {
      adding.current = false;
      setAttaching(false);
    }
  };
  return (
    <form
      className="feedback-composer"
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length) {
          e.preventDefault();
          void attach(files);
        }
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSend(body, images, title);
          setBody("");
          setTitle("");
          setImages([]);
        } catch (e) {
          setError(String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {titleRequired && (
        <input
          required
          maxLength={160}
          value={title}
          aria-label="Post title"
          placeholder="Give your feedback a title"
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      )}
      <textarea
        aria-label={titleRequired ? "Post description" : "Reply message"}
        placeholder={
          titleRequired
            ? "Describe your idea or the problem. You can paste images here."
            : "Write a reply or paste an image…"
        }
        value={body}
        maxLength={10000}
        rows={titleRequired ? 5 : 3}
        onChange={(e) => setBody(e.target.value)}
        disabled={busy}
      />
      {!!images.length && (
        <div className="feedback-attachments">
          {images.map((data, i) => (
            <figure key={i}>
              <img src={data} alt={"Attached image " + (i + 1)} />
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setImages((old) => old.filter((_, n) => n !== i))
                }
              >
                Remove image {i + 1}
              </button>
            </figure>
          ))}
        </div>
      )}
      <div className="actions">
        <label className="feedback-upload">
          ＋ Upload images
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            disabled={busy || attaching}
            onChange={(e) => {
              void attach(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
        <small>Up to 3 images · large images resize automatically</small>
        <button
          className="primary"
          disabled={
            busy ||
            attaching ||
            (!body.trim() && !images.length) ||
            (titleRequired && !title.trim())
          }
        >
          {busy ? "Sending…" : titleRequired ? "Create post" : "Send reply"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function Feedback({ admin }: { admin: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]),
    [query, setQuery] = useState(""),
    [label, setLabel] = useState(""),
    [selected, setSelected] = useState<number>(),
    [thread, setThread] = useState<Thread>(),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [older, setOlder] = useState(false);
  const listVersion = useRef(0),
    threadVersion = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++listVersion.current;
    try {
      const r = await api("feedbackList", { query, label });
      if (n === listVersion.current) {
        setPosts(r.posts);
        setMore(r.posts.length === 50);
        setError("");
      }
    } catch (e) {
      if (n === listVersion.current) setError(String(e));
    } finally {
      if (n === listVersion.current) setLoading(false);
    }
  }, [query, label]);
  const loadThread = useCallback(async () => {
    if (!selected) return;
    const n = ++threadVersion.current;
    try {
      const r: Thread = await api("feedbackThread", { id: selected });
      if (n === threadVersion.current) {
        setThread((previous) =>
          previous?.post.id === r.post.id
            ? {
                ...r,
                messages: [
                  ...new Map(
                    [...previous.messages, ...r.messages].map((m) => [m.id, m]),
                  ).values(),
                ].sort((a, b) => a.id - b.id),
              }
            : r,
        );
        setOlder(r.messages.length === 50);
        setError("");
      }
    } catch (e) {
      if (n === threadVersion.current) setError(String(e));
    }
  }, [selected]);
  useEffect(() => {
    setLoading(true);
    const delay = setTimeout(() => void refresh(), 250);
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      clearTimeout(delay);
      clearInterval(timer);
      listVersion.current++;
    };
  }, [refresh]);
  useEffect(() => {
    setThread(undefined);
    setOlder(false);
    void loadThread();
    const timer = setInterval(() => void loadThread(), 15000);
    return () => {
      clearInterval(timer);
      threadVersion.current++;
    };
  }, [loadThread]);
  const moderate = async (action: string, newLabel?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api("moderateFeedback", { id: selected, action, label: newLabel });
      if (action === "delete") {
        setSelected(undefined);
        setThread(undefined);
      } else await loadThread();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="feedback-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">HELP SHAPE EMBER</p>
          <h1>Feedback</h1>
          <p>Browse ideas, report bugs, and follow progress.</p>
        </div>
        <div className="actions">
          <button
            onClick={() => {
              void refresh();
              void loadThread();
            }}
          >
            ↻ Refresh
          </button>
          <button
            className="primary"
            onClick={() => {
              setCreating(true);
              setSelected(undefined);
            }}
          >
            ＋ New post
          </button>
        </div>
      </div>
      <div className="feedback-tools">
        <input
          type="search"
          aria-label="Search feedback"
          placeholder="Search posts…"
          value={query}
          maxLength={150}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter feedback label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        >
          <option value="">All labels</option>
          {labels.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert">
          {error.includes("404")
            ? "Feedback is not available on this account service yet. Deploy the updated server first."
            : error}
        </p>
      )}
      <div
        className={
          "feedback-layout" + (selected || creating ? " has-panel" : "")
        }
      >
        <div className="feedback-board" aria-label="Feedback posts">
          {loading && !posts.length ? (
            <p role="status">Loading feedback…</p>
          ) : !posts.length ? (
            <p>No posts found. Be the first to share feedback.</p>
          ) : (
            posts.map((post) => (
              <button
                key={post.id}
                className={
                  "feedback-card" + (selected === post.id ? " selected" : "")
                }
                onClick={() => {
                  setCreating(false);
                  setSelected(post.id);
                }}
              >
                <small>
                  {post.authorName} ·{" "}
                  {new Date(post.created).toLocaleDateString()}
                </small>
                <strong>{post.title}</strong>
                <p>{post.body}</p>
                {post.imageId && <FeedbackImage id={post.imageId} />}
                <footer>
                  <span className="pill">{post.label}</span>
                  <small>{Math.max(0, post.messageCount - 1)} replies</small>
                </footer>
              </button>
            ))
          )}
          {more && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const n = listVersion.current;
                try {
                  const r = await api("feedbackList", {
                    query,
                    label,
                    before: posts.at(-1)?.id,
                  });
                  if (n === listVersion.current) {
                    setPosts((old) => [...old, ...r.posts]);
                    setMore(r.posts.length === 50);
                  }
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Older posts
            </button>
          )}
        </div>
        {(selected || creating) && (
          <aside
            className="feedback-panel"
            aria-label={
              creating ? "Create feedback post" : "Feedback discussion"
            }
          >
            <header className="section-heading">
              <h2>
                {creating
                  ? "New feedback post"
                  : thread?.post.title || "Loading discussion…"}
              </h2>
              <button
                aria-label="Close feedback panel"
                onClick={() => {
                  setCreating(false);
                  setSelected(undefined);
                }}
              >
                ✕
              </button>
            </header>
            {creating ? (
              <Composer
                titleRequired
                onSend={async (body, images, title) => {
                  const r = await api("createFeedback", {
                    body,
                    images,
                    title,
                  });
                  setCreating(false);
                  setSelected(r.id);
                  await refresh();
                }}
              />
            ) : (
              thread && (
                <>
                  <div className="feedback-moderation">
                    <span className="pill">{thread.post.label}</span>
                    {admin && (
                      <>
                        <select
                          aria-label="Set feedback label"
                          value={thread.post.label}
                          disabled={busy}
                          onChange={(e) =>
                            void moderate("label", e.target.value)
                          }
                        >
                          {labels.map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this post and all its messages and images?",
                              )
                            )
                              void moderate("delete");
                          }}
                        >
                          Delete post
                        </button>
                      </>
                    )}
                  </div>
                  <div className="feedback-messages" aria-live="polite">
                    {older && (
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          const n = threadVersion.current;
                          try {
                            const r: Thread = await api("feedbackThread", {
                              id: selected,
                              before: thread.messages[0]?.id,
                            });
                            if (n === threadVersion.current) {
                              setThread((old) =>
                                old
                                  ? {
                                      ...old,
                                      messages: [
                                        ...r.messages,
                                        ...old.messages,
                                      ],
                                    }
                                  : old,
                              );
                              setOlder(r.messages.length === 50);
                            }
                          } catch (e) {
                            setError(String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Older replies
                      </button>
                    )}
                    {thread.messages.map((m) => (
                      <article className="feedback-message" key={m.id}>
                        <header>
                          <strong>
                            {m.authorName}
                            {m.role === "admin" ? " · Ember admin" : ""}
                          </strong>
                          <time>{new Date(m.created).toLocaleString()}</time>
                        </header>
                        <p>{m.body}</p>
                        {m.images.map((id) => (
                          <FeedbackImage key={id} id={id} />
                        ))}
                      </article>
                    ))}
                  </div>
                  {thread.canReply ? (
                    <Composer
                      key={thread.post.id}
                      onSend={async (body, images) => {
                        await api("replyFeedback", {
                          id: selected,
                          body,
                          images,
                        });
                        await loadThread();
                        await refresh();
                      }}
                    />
                  ) : (
                    <p className="feedback-readonly">
                      Everyone can read this discussion. Only the post creator
                      and Ember admins can reply.
                    </p>
                  )}
                </>
              )
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
