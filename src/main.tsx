import { Trailer } from './Trailer';
import {AccountGate, type AccountUser} from './AccountGate';
import {Updates} from './Updates';
import {LauncherUpdateDialog} from './LauncherUpdateDialog';
import { SourcePicker, SourceSettings } from "./DownloadSources";
import { InfiniteLoader } from './InfiniteLoader';
import { catalogCandidates } from './catalog-view';
import {downloadOptions} from './package-matching';
import {useArtworkTheme} from './useArtworkTheme';
import { belongsInLibrary } from "./library-membership";
import { ScreenshotGallery } from "./ScreenshotGallery";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import type { Game } from "./types";
import type { CatalogGame, V2Snapshot, V2Action, Preferences } from "./v2types";
import {
  SteamDetails,
  AboutGame,
  playedSeconds,
  deckLabel,
} from "./SteamDetails";
import { quality } from "./recommendations";
import { homeSelection } from "./home";
import { GameCover } from "./GameCover";
import { steamCoverSources } from "./steam-covers";
import "./style.css";
import "./v2.css";
const navigation = [
  ["HOME", ["Home"]],
  ["LIBRARY", ["Steam Library", "Library"]],
  ["GAMES", ["All Games", "Coming Soon", "Top Sellers"]],
  ["MANAGE", ["Downloads", "Settings"]],
] as const;
const icons: Record<string, string> = {
  Home: "⌂",
  "Steam Library": "◉",
  Library: "▦",
  "All Games": "◇",
  "Coming Soon": "◷",
  "Top Sellers": "↗",
  Downloads: "↓",
  Settings: "⚙",
};
const hours = (seconds: number) =>
  (seconds / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 }) +
  " h";
const bytes = (n: number) =>
  n >= 1024 ** 3
    ? (n / 1024 ** 3).toFixed(1) + " GB"
    : n >= 1024 ** 2
      ? (n / 1024 ** 2).toFixed(1) + " MB"
      : (n / 1024).toFixed(1) + " KB";
const last = (g: Game) =>
  g.steam?.lastPlayed
    ? g.steam.lastPlayed * 1000
    : Date.parse(g.lastPlayed || "") || 0;
const playLabel = (g: Game) =>
  g.store === "steam" && g.steam?.playtimeMinutes === undefined
    ? "Unavailable"
    : hours(playedSeconds(g));
function App({user,logout}:{user:AccountUser;logout:()=>void}) {
  const catalogRequest=useRef(0);
  const [updateDialog,setUpdateDialog]=useState(false),[unreadUpdates,setUnreadUpdates]=useState(false),[updatesVisit,setUpdatesVisit]=useState(0);
  const announcementsRequest=useRef(0);
  const readAnnouncements=useCallback(async(through:number)=>{
    const request=++announcementsRequest.current;
    const status=await window.ember2.call('readAnnouncements',{through});
    if(request===announcementsRequest.current)setUnreadUpdates(status.unread);
  },[]);
  useEffect(()=>{
    let active=true;
    const check=async()=>{const request=++announcementsRequest.current;try{const status=await window.ember2.call('announcementStatus');if(active&&request===announcementsRequest.current)setUnreadUpdates(status.unread);}catch{/* Account gate handles service outages. */}};
    void check();const timer=setInterval(()=>void check(),30000);
    const focus=()=>void check();window.addEventListener('focus',focus);
    return()=>{active=false;announcementsRequest.current++;clearInterval(timer);window.removeEventListener('focus',focus);};
  },[]);
  const [snap, setSnap] = useState<V2Snapshot>(),
    [page, setPage] = useState("Home"),
    [collapsed, setCollapsed] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(0),
    [detail, setDetail] = useState<string>(),
    [meta, setMeta] = useState<CatalogGame>(),
    [sources, setSources] = useState(false),
    [edit, setEdit] = useState<Game>();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("name"),
    [view, setView] = useState("grid"),
    [filter, setFilter] = useState("all"),
    [genre, setGenre] = useState("all"),
    [platform, setPlatform] = useState("all"),
    [results, setResults] = useState<CatalogGame[]>([]),
    [pageIndex, setPageIndex] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [sourceLabel, setSourceLabel] = useState(""),
    [clock, setClock] = useState(Date.now()),
    [rating, setRating] = useState(0),
    [reviewCount, setReviewCount] = useState(0),
    [year, setYear] = useState("all"),
    [rankLimit, setRankLimit] = useState(20);
  const latestSnapshot = useRef<V2Snapshot | undefined>(undefined);
  const refreshTask = useRef<Promise<void> | undefined>(undefined);
  const refresh = useCallback(() => {
    if(refreshTask.current) return refreshTask.current;
    refreshTask.current = (async()=>{
      const next = await window.ember2.call('snapshot',{sourcesRevision:latestSnapshot.current?.sourcesRevision});
      if(!next.state.sources) next.state.sources=latestSnapshot.current?.state.sources || [];
      latestSnapshot.current=next;setSnap(next);
    })().finally(()=>{refreshTask.current=undefined});
    return refreshTask.current;
  },[]);
  const call = useCallback(
    async (action: V2Action, p?: any) => {
      setPending((n) => n + 1);
      setError("");
      try {
        const result = await window.ember2.call(action, p);
        await refresh();
        return result;
      } catch (e) {
        setError(
          String(e).replace(
            /^Error: Error invoking remote method '[^']+': Error: /,
            "",
          ),
        );
        return undefined;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [refresh],
  );
  useEffect(()=>{
    let active=true;
    const updateStatus=async()=>{try{const launcherUpdate=await window.ember2.call('launcherUpdateStatus');if(active)setSnap(current=>current?{...current,launcherUpdate}:current);}catch{/* Retry at the next poll or focus. */}};
    void updateStatus();const timer=setInterval(()=>void updateStatus(),60000);
    const focus=()=>void updateStatus();window.addEventListener('focus',focus);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',focus);};
  },[]);
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
    const off = window.ember2.subscribe(
      () => void refresh().catch((e) => setError(String(e))),
    );
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let current = true;
    setMeta(undefined);
    setSources(false);
    if (detail?.startsWith("steam-"))
      void window.ember2
        .call("detail", { id: detail.slice(6) })
        .then((m) => {
          if (current) {
            if (!m) setDetail(undefined);
            setMeta(m || undefined);
            void refresh();
          }
        })
        .catch((e) => {
          if (current) setError(String(e));
        });
    return () => {
      current = false;
    };
  }, [detail, refresh]);
  useEffect(() => {
    let current = true;
    catalogRequest.current++;
    setResults([]);
    setPageIndex(0);
    setHasMore(false);
    if (["All Games", "Coming Soon"].includes(page)) {
      setPending((n) => n + 1);
      void window.ember2
        .call("catalog", {
          kind: page === "Coming Soon" ? "coming" : "all",
          term: query,
          page: 0,
        })
        .then((r) => {
          if (current) {
            setResults(r.games);
            setHasMore(r.hasMore);
            setSourceLabel(r.source);
            void refresh();
          }
        })
        .catch((e) => {
          if (current) setError(String(e));
        })
        .finally(() => setPending((n) => n - 1));
    } else if (page === "Top Sellers") void call("rankings", { offset: 0 });
    return () => {
      current = false;
    };
  }, [page, query]);
  const navigate = (next: string) => {
    if(next==='Updates')setUpdatesVisit(n=>n+1);
    setPage(next);
    setDetail(undefined);
    setSearch("");
    setFilter("all");
    setGenre("all");
    setPlatform("all");
    setRating(0);
    setReviewCount(0);
    setYear("all");
    setError("");
  };
  const filteredDiscovery=filter!=='all'||genre!=='all'||platform!=='all'||rating>0||reviewCount>0||year!=='all';
  const home=useMemo(()=>snap?homeSelection(snap.games,snap.state.catalog,snap.state.preferences,snap.state.visits,snap.running):undefined,[snap]);
  const gamesByCatalog=useMemo(()=>{
    const index=new Map<string,Game>();
    for(const game of snap?.games||[])for(const id of [game.steamId,game.catalogId])if(id)index.set(id,game);
    return index;
  },[snap]);
  const discoveryGames=useMemo(()=>snap?catalogCandidates(results,snap.state.catalog,page==='Coming Soon'?'coming':'all',filteredDiscovery).filter(m=>quality(m,snap.state.preferences)):[],[results,snap,page,filteredDiscovery]);
  const genres=useMemo(()=>[...new Set(Object.values(snap?.state.catalog||{}).flatMap(g=>g.genres))].sort(),[snap]);
  const detailMeta=meta||(detail?.startsWith('steam-')?snap?.state.catalog[detail.slice(6)]:undefined);
  const officialSourceDownload=useMemo(()=>Boolean(detailMeta?.purchaseUrl)&&downloadOptions(snap?.state.sources||[],detailMeta?.origin?undefined:detailMeta?.steamAppId||detailMeta?.appId,detailMeta?.title||'',snap?.platform||'').length>0,[snap?.state.sources,snap?.platform,detailMeta?.purchaseUrl,detailMeta?.origin,detailMeta?.steamAppId,detailMeta?.appId,detailMeta?.title]);
  const loadMore=async()=>{
    const request=catalogRequest.current;
    const r=await call('catalog',{kind:page==='Coming Soon'?'coming':'all',term:query,page:pageIndex+1});
    if(request!==catalogRequest.current)return;
    if(!r)throw Error('Unable to load more games');
    setResults(old=>[...new Map([...old,...r.games].map(g=>[g.appId,g])).values()]);setPageIndex(n=>n+1);setHasMore(r.hasMore);
  };
  const themeGame=detail?snap?.games.find(g=>g.id===detail||Boolean(g.catalogId===detail.replace(/^steam-/,''))):home?.heroGame;
  const themeMeta=detail?detailMeta:home?.heroMeta;
  const artworkTheme=useArtworkTheme([themeMeta?.portrait,themeGame?.artwork,themeMeta?.cover,themeGame?.hero,themeMeta?.banner],detail?themeGame?.themeColor:home?.heroGame?.themeColor);
  if (!snap)
    return (
      <div className="startup">
        <img src="./launcher.png" />
        <h1>Ember</h1>
        <p>{error || "Opening your library…"}</p>
      </div>
    );
  const { state, games } = snap,
    installed = games.filter((g) => g.installed),
    steamOwned = games.filter((g) => g.store === "steam" && g.owned),
    local = games.filter((g) => g.store === "local"),
    game = games.find((g) => g.id === detail || (Boolean(detail) && Boolean(g.catalogId) && g.catalogId===detail?.replace(/^steam-/,'')) || (Boolean(detail) && g.store==='local' && Boolean(g.steamId) && g.steamId===detail?.replace(/^steam-/,''))),
    selectedMeta =
      meta ||
      (detail?.startsWith("steam-")
        ? state.catalog[detail.slice(6)]
        : undefined);
  const displayVersion=(snap.launcherUpdate?.currentVersion||'1.0.0').split('.').slice(0,2).join('.');
  const native = (m?: CatalogGame, g?: Game) => {
    if (
      snap.platform === "darwin" &&
      g &&
      (g.platform === "windows" || /\.(exe|msi)$/i.test(g.executable))
    )
      return false;
    return m
      ? m.platforms.includes(snap.platform === "darwin" ? "mac" : "windows")
      : g?.store === "local" || snap.platform === "win32";
  };
  const status = (g?: Game) =>
    g?.installed
      ? "Installed"
      : g?.saved && !g.owned
        ? "Saved"
        : "Not Installed";
  const open = (id: string) => {
    setDetail(id);
    setError("");
  };
  const { recommendations, recent, recentPick, heroGame, heroMeta, discover } =
    home!;
  const heroId =
    heroGame?.id || (heroMeta ? "steam-" + heroMeta.appId : undefined);
  const theme = artworkTheme;
  function actionButtons(g: Game | undefined, m: CatalogGame | undefined) {
    const id = g?.steamId || g?.catalogId || m?.steamAppId || m?.appId;
    const job = [...state.downloads].reverse().find(j => j.package.steamAppId === id && j.status !== "canceled");
    return <><div className="actions">
      {g?.installed ? <button className="primary" disabled={!native(m,g)||snap!.running.includes(g.id)} onClick={()=>void call("launch",{id:g.id})}>{snap!.running.includes(g.id)?"Running":"▶ Play"}</button> : id && !(m?.comingSoon||m?.isFree||m?.price==='Free') && (!m?.purchaseUrl||officialSourceDownload) ? <button className="primary" onClick={()=>setSources(true)}>Download</button> : null}
      {g?.installed && (g.managed || state.downloads.some(j=>j.installedGameId===g.id)) && <button disabled={snap!.running.includes(g.id)} onClick={()=>void call('uninstall',{id:g.id})}>Uninstall</button>}
      {id && (!m?.productType||m.productType==='game') && <button onClick={()=>void call("saveGame",{id})}>{g?.saved?"♥ Saved":"♡ Save to library"}</button>}
      {id && (!m?.origin || m?.purchaseUrl) && <button onClick={()=>void call("store",{id})}>{m?.origin?'View ↗':'View on Steam ↗'}</button>}
      {job?.status==='completed'&&!g?.installed&&<button onClick={()=>void call('detectInstall',{id:job.id})}>Find installed game</button>}
      {g?.store==='steam' && g.steamId && g.owned && !g.installed && !m?.comingSoon && <button disabled={!native(m,g)} onClick={()=>void call("installSteam",{id:g.steamId})}>Install in Steam</button>}
      {!native(m,g)&&<small>{officialSourceDownload?'Downloads available from enabled sources · game compatibility is unverified.':'Unavailable on this platform · native games only'}</small>}
    </div>{job&&<button className="game-download-progress" onClick={()=>navigate("Downloads")} aria-label="View game download">
      <span>{job.status === "external" ? "Continue on download host" : job.status + (job.total>0?" · "+Math.min(100,job.downloaded/job.total*100).toFixed(1)+"%":" · waiting for metadata")} →</span>
      {job.status !== "external"&&<progress max={job.total||1} value={job.total?job.downloaded:undefined}/>}
    </button>}</>;
  }
  function card(
    g: Game | undefined,
    m: CatalogGame | undefined,
    rank?: number,
  ) {
    m=(g?.catalogId&&state.catalog[g.catalogId])||m;
    const id = g?.id || "steam-" + m!.appId;
    return (
      <article className="v2-card" key={id}>
        <button className="card-open" onClick={() => open(id)}>
          <div className="card-image">
            <GameCover
              key={id+":"+(m?.updated||"")}
              sources={[m?.portrait,...steamCoverSources(g?.steamId || m?.steamAppId || m?.appId, g?.artwork),m?.cover]}
              title={g?.name || m?.title || "Game"}
            />
            {rank && <b className="rank">#{rank}</b>}
            <span className="card-status">
              {g
                ? status(g)
                : m?.comingSoon
                  ? "Coming soon"
                  : m?.price || "Discover"}
            </span>
          </div>
          <strong>{g?.name || m?.title}</strong>
          <small>
            {m?.reviews?.total
              ? `${Math.round((m.reviews.positive / m.reviews.total) * 100)}% positive · ${m.reviews.total.toLocaleString()} reviews`
              : g && playedSeconds(g) > 0
                ? hours(playedSeconds(g))
                : m?.comingSoon
                  ? m.releaseDate
                  : "Not Enough Reviews"}
          </small>
        </button>
        {g && (
          <small>
            {playLabel(g)}
            {last(g) > 0
              ? " · Last played " + new Date(last(g)).toLocaleDateString()
              : ""}
          </small>
        )}
        {m && (
          <small>
            {m.platforms.join(" / ")}
            {m.price ? " · " + m.price : ""}
            {m.comingSoon
              ? " · " + m.releaseDate + " (publisher estimate)"
              : ""}
          </small>
        )}
        {m?.comingSoon && (
          <small>
            {m.developers.join(", ")} · {m.genres.join(", ")}
          </small>
        )}
        {g?.installed && (
          <button
            className="card-play"
            disabled={!native(m, g) || snap!.running.includes(g.id)}
            onClick={() => void call("launch", { id: g.id })}
          >
            {snap!.running.includes(g.id) ? "Running" : "▶ Play"}
          </button>
        )}
        {g?.store === "steam" && g.owned && !g.installed && !m?.comingSoon && (
          <button
            className="card-play"
            disabled={!native(m, g)}
            onClick={() => void call("installSteam", { id: g.steamId })}
          >
            Install in Steam
          </button>
        )}
      </article>
    );
  }
  const filterMeta = (m?: CatalogGame, g?: Game) => {
    if (
      query &&
      !(g?.name || m?.title || "").toLowerCase().includes(query.toLowerCase())
    )
      return false;
    if (genre !== "all" && !m?.genres.includes(genre)) return false;
    if (platform !== "all" && !m?.platforms.includes(platform as any))
      return false;
    if (
      rating &&
      (!m?.reviews?.total ||
        (m.reviews.positive / m.reviews.total) * 100 < rating)
    )
      return false;
    if (reviewCount && (m?.reviews?.total || 0) < reviewCount) return false;
    if (
      year !== "all" &&
      (!m?.releaseTimestamp ||
        new Date(m.releaseTimestamp).getFullYear() !== Number(year))
    )
      return false;
    if (
      (filter === "installed" && !g?.installed) ||
      (filter === "owned" && !g?.owned) ||
      (filter === "saved" && !g?.saved) ||
      (filter === "uninstalled" && g?.installed)
    )
      return false;
    return true;
  };
  const compareMeta = (
    a: CatalogGame | undefined,
    b: CatalogGame | undefined,
  ) =>
    sort === "quality"
      ? (b?.reviews?.positive || 0) / Math.max(1, b?.reviews?.total || 0) -
        (a?.reviews?.positive || 0) / Math.max(1, a?.reviews?.total || 0)
      : sort === "popularity"
        ? (b?.reviews?.total || 0) - (a?.reviews?.total || 0)
        : sort === "release"
          ? (a?.releaseTimestamp || Infinity) -
            (b?.releaseTimestamp || Infinity)
          : (a?.title || "").localeCompare(b?.title || "");
  const libraryGames = games
    .filter(belongsInLibrary)
    .filter(
      (g) =>
        (page !== "Steam Library" || (g.store === "steam" && g.owned)) &&
        filterMeta(g.steamId ? state.catalog[g.steamId] : undefined, g),
    )
    .sort((a, b) =>
      sort === "played"
        ? playedSeconds(b) - playedSeconds(a)
        : sort === "recent"
          ? last(b) - last(a)
          : sort === "added"
            ? Date.parse(b.added) - Date.parse(a.added)
            : ["quality", "popularity", "release"].includes(sort)
              ? compareMeta(
                  state.catalog[a.steamId!],
                  state.catalog[b.steamId!],
                )
              : a.name.localeCompare(b.name),
    );
  const filters = (
    <div className="filter-row">
      <select
        aria-label="Library status"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">All statuses</option>
        <option value="installed">Installed</option>
        <option value="uninstalled">Not installed</option>
        <option value="owned">Owned</option>
        <option value="saved">Saved</option>
      </select>
      <select
        aria-label="Genre"
        value={genre}
        onChange={(e) => setGenre(e.target.value)}
      >
        <option value="all">Every genre</option>
        {genres.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <select
        aria-label="Platform"
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
      >
        <option value="all">All platforms</option>
        <option value="windows">Windows</option>
        <option value="mac">macOS native</option>
      </select>
      <select
        aria-label="Sort"
        disabled={page === "Top Sellers"}
        title={
          page === "Top Sellers"
            ? "Top Sellers always preserves source order"
            : "Sort loaded games"
        }
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        <option value="name">Name</option>
        {["Library", "Steam Library"].includes(page) && (
          <>
            <option value="played">Most played</option>
            <option value="recent">Recently played</option>
            <option value="added">Recently added</option>
          </>
        )}
        <option value="quality">Review quality</option>
        <option value="popularity">Review count (popularity proxy)</option>
        <option value="release">Release date</option>
      </select>
      <select
        aria-label="Minimum rating"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
      >
        <option value={0}>Any review score</option>
        <option value={70}>70%+ positive</option>
        <option value={90}>90%+ positive</option>
      </select>
      <select
        aria-label="Minimum reviews"
        value={reviewCount}
        onChange={(e) => setReviewCount(Number(e.target.value))}
      >
        <option value={0}>Any review count</option>
        <option value={100}>100+ reviews</option>
        <option value={1000}>1,000+ reviews</option>
      </select>
      <select
        aria-label="Release year"
        value={year}
        onChange={(e) => setYear(e.target.value)}
      >
        <option value="all">Every release year</option>
        {[
          ...new Set(
            Object.values(state.catalog)
              .filter((m) => m.releaseTimestamp)
              .map((m) => new Date(m.releaseTimestamp!).getFullYear()),
          ),
        ]
          .sort((a, b) => b - a)
          .map((y) => (
            <option key={y}>{y}</option>
          ))}
      </select>
      <button onClick={() => setView(view === "grid" ? "list" : "grid")}>
        {view === "grid" ? "☷ List" : "▦ Grid"}
      </button>
    </div>
  );
  return (
    <div
      className={"v2-app " + (collapsed ? "compact" : "")}
      style={{ "--theme": theme } as React.CSSProperties}
    >
      <aside className="v2-sidebar">
        <button className="brand" onClick={() => navigate("Home")}>
          <img src="./launcher.png" alt="Ember icon" />
          {!collapsed && (
            <span>
              ember<span className="version">{displayVersion}</span>
            </span>
          )}
        </button>
        <button
          className="collapse"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "›" : "‹"}
          {!collapsed && " Collapse"}
        </button>
        {navigation.map(([label, items]) => (
          <nav key={label} aria-label={label}>
            {!collapsed && <small>{label}</small>}
            {items.map((item) => (
              <button
                key={item}
                title={item}
                className={page === item ? "selected" : ""}
                onClick={() => navigate(item)}
              >
                <span>{icons[item]}</span>
                {!collapsed && item}
                {!collapsed && item === "Downloads" && (
                  <em>
                    {state.downloads.filter(
                      (d) => !["completed", "canceled"].includes(d.status),
                    ).length || ""}
                  </em>
                )}
              </button>
            ))}
          </nav>
        ))}
        <div className="sidebar-bottom">
          <button className={page==='Updates'?'selected':''} title="Updates" aria-label="Updates" onClick={()=>navigate('Updates')}>✦ {!collapsed&&'Updates'}{unreadUpdates&&<span className="updates-unread" role="status" aria-label="Unread announcements"/>}</button>
          {!collapsed&&<small>{user.displayName||user.username}{user.role==='admin'?' · Admin':''}</small>}
          <button title="Log out" aria-label="Log out" onClick={logout}>↪ {!collapsed&&'Log out'}</button>
          {!collapsed && (
            <>
              <span className="status-dot" />{" "}
              {snap.platform === "darwin"
                ? "macOS · Native only"
                : "Windows · Native"}
              <small>Your games. Your space.</small>
            </>
          )}
        </div>
      </aside>
      <main className="v2-main">
        <header className="v2-topbar">
          <div>
            {detail ? (
              <button onClick={() => setDetail(undefined)}>← Back</button>
            ) : (
              <span>{page}</span>
            )}
          </div>
          {snap.launcherUpdate?.release&&<button className="launcher-update-available" onClick={()=>setUpdateDialog(true)}>Update available</button>}
          <input
            aria-label="Search games"
            hidden={["Settings", "Downloads"].includes(page) && !detail}
            placeholder="Search games…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (page === "Home" || detail) {
                setDetail(undefined);
                setPage("Library");
              }
            }}
          />
          <button onClick={() => void call("addGame")}>＋ Add game</button>
        </header>
        {updateDialog&&snap.launcherUpdate?.release&&<LauncherUpdateDialog state={snap.launcherUpdate} onClose={()=>setUpdateDialog(false)}/>}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {(pending > 0 || snap.busy) && (
          <div className="activity" role="status">
            {snap.busy ? snap.message : "Working…"}
          </div>
        )}
        <div className="v2-page" key={detail || page}>
          {detail ? (
            <>
              <section
                className="v2-hero detail-hero"
                style={{
                  backgroundImage: `linear-gradient(90deg,rgba(13,22,24,.8),transparent),linear-gradient(0deg,var(--theme),transparent 75%),url("${game?.hero || selectedMeta?.banner || ""}"),url("${selectedMeta?.cover || selectedMeta?.portrait || ""}")`,
                }}
              >
                <div>
                  <span className="eyebrow">
                    {game ? status(game) : "DISCOVER"} /{" "}
                    {selectedMeta?.platforms.join(" + ") || "LOCAL GAME"}
                  </span>
                  {game?.logo ? (
                    <img
                      className="game-logo"
                      src={game.logo}
                      alt={game.name}
                    />
                  ) : (
                    <h1>
                      {game?.name || selectedMeta?.title || "Loading game…"}
                    </h1>
                  )}
                  <p>
                    {selectedMeta?.developers.join(", ")}{" "}
                    {selectedMeta?.releaseDate &&
                      " · " + selectedMeta.releaseDate}
                  </p>
                  {actionButtons(game, selectedMeta)}
                </div>
              </section>
              <div className="stat-strip">
                <div>
                  <small>PLAYTIME</small>
                  <b>{game ? playLabel(game) : "—"}</b>
                </div>
                <div>
                  <small>STEAM DECK</small>
                  <b>{game ? deckLabel(game) : "Unavailable"}</b>
                </div>
                <div>
                  <small>REVIEWS</small>
                  <b>
                    {selectedMeta?.reviews?.total
                      ? Math.round(
                          (selectedMeta.reviews.positive /
                            selectedMeta.reviews.total) *
                            100,
                        ) + "% positive"
                      : "Not enough data"}
                  </b>
                </div>
                <div>
                  <small>RELEASE</small>
                  <b>{selectedMeta?.releaseDate || "Unavailable"}</b>
                </div>
              </div>
              {game && (
                <div className="actions management">
                  {game.installed && (
                    <button
                      onClick={() => void call("reveal", { id: game.id })}
                    >
                      Open folder
                    </button>
                  )}
                  <button onClick={() => setEdit({ ...game })}>
                    Edit details
                  </button>
                  <button
                    onClick={() =>
                      void call("removeGame", { id: game.id }).then(() =>
                        setDetail(undefined),
                      )
                    }
                  >
                    Remove from library
                  </button>
                  {game.installed &&
                    game.store === "steam" && (
                      <button
                        onClick={() => void call("uninstall", { id: game.id })}
                      >
                        Uninstall{game.store === "steam" ? " in Steam" : ""}
                      </button>
                    )}
                </div>
              )}
              {selectedMeta ? (
                <section className="v2-about">
                  <span className="eyebrow">ABOUT THIS GAME</span>
                  <p>{selectedMeta.description}</p>
                  <small>
                    Publisher description from Steam · retrieved{" "}
                    {new Date(selectedMeta.updated).toLocaleDateString()}
                  </small>
                  <div className="tags">
                    {selectedMeta.genres.map((g) => (
                      <button key={g} onClick={()=>{navigate('All Games');setGenre(g);}}>{g}</button>
                    ))}
                  </div>
                </section>
              ) : game ? (
                <AboutGame game={game} />
              ) : null}
              {selectedMeta?.screenshots.length ? <ScreenshotGallery key={detail} images={selectedMeta.screenshots} /> : null}
              {selectedMeta?.trailers?.length ? <section><h2>Trailer</h2><Trailer poster={selectedMeta.banner} src={selectedMeta.trailers[0]} /></section>:null}
              {game?.store === "steam" && <SteamDetails game={game} />}
            </>
          ) : page === "Updates" ? <Updates admin={user.role==='admin'} onRead={readAnnouncements} refreshSignal={updatesVisit}/> : page === "Home" ? (
            <>
              <section
                className="v2-hero"
                style={{
                  backgroundImage: `linear-gradient(90deg,rgba(13,22,24,.8),transparent),linear-gradient(0deg,var(--theme),transparent 75%),url("${heroGame?.hero || heroMeta?.banner || ""}"),url("${heroMeta?.cover || heroMeta?.portrait || ""}")`,
                }}
              >
                <div>
                  <span className="eyebrow">
                    {discover
                      ? "DISCOVER SOMETHING NEW"
                      : recentPick
                        ? "PICK UP WHERE YOU LEFT OFF"
                        : "WELCOME TO YOUR SPACE"}
                  </span>
                  {heroGame?.logo ? (
                    <img
                      className="game-logo"
                      src={heroGame.logo}
                      alt={heroGame.name}
                    />
                  ) : (
                    <h1>
                      {heroGame?.name ||
                        heroMeta?.title ||
                        "Good games.\nAll together."}
                    </h1>
                  )}
                  <p>
                    {heroMeta?.description.slice(0, 180) ||
                      (heroGame
                        ? "Ready when you are."
                        : "Add a native game or import your Steam installations to get started.")}
                  </p>
                  <div className="actions">
                    {heroGame?.installed ? (
                      <button
                        className="primary"
                        disabled={!native(heroMeta, heroGame)}
                        onClick={() => void call("launch", { id: heroGame.id })}
                      >
                        ▶ Play now
                      </button>
                    ) : heroId ? (
                      <button className="primary" onClick={() => open(heroId)}>
                        View game
                      </button>
                    ) : (
                      <button
                        className="primary"
                        onClick={() => void call("importSteam")}
                      >
                        Import Steam installations
                      </button>
                    )}
                    {heroId && (
                      <button onClick={() => open(heroId)}>
                        Game details →
                      </button>
                    )}
                  </div>
                </div>
              </section>
              <section className="stat-strip home-stats">
                {[
                  ["ALL GAMES", games.length],
                  [
                    "STEAM PLAYTIME",
                    hours(
                      games
                        .filter((g) => g.store === "steam")
                        .reduce((s, g) => s + playedSeconds(g), 0),
                    ),
                  ],
                  [
                    "EMBER PLAYTIME",
                    hours(local.reduce((s, g) => s + g.seconds, 0)),
                  ],
                  [
                    "TOTAL PLAYTIME",
                    hours(games.reduce((sum, g) => sum + playedSeconds(g), 0)),
                  ],
                  ["INSTALLED", installed.length],
                  [
                    "DECK VERIFIED",
                    games.filter((g) => g.steam?.deck === "verified").length,
                  ],
                  [
                    "ADDED THIS WEEK",
                    games.filter(
                      (g) => Date.now() - Date.parse(g.added) < 604800000,
                    ).length,
                  ],
                ].map(([k, v]) => (
                  <div key={k}>
                    <small>{k}</small>
                    <b>{v}</b>
                  </div>
                ))}
              </section>
              <section>
                <div className="section-heading">
                  <h2>Recently played</h2>
                  <button onClick={() => navigate("Library")}>
                    Your library →
                  </button>
                </div>
                {recent.length ? (
                  <div className="carousel">
                    {recent
                      .slice(0, 12)
                      .map((g) =>
                        card(
                          g,
                          g.steamId ? state.catalog[g.steamId] : undefined,
                        ),
                      )}
                  </div>
                ) : (
                  <p className="empty">
                    Play a game or refresh Steam to see your recent activity.
                  </p>
                )}
              </section>
              <section>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      BASED ON YOUR GENRES, PLAYTIME & REVIEWS
                    </span>
                    <h2>A little more your style</h2>
                  </div>
                  <button onClick={() => navigate("All Games")}>
                    Explore games →
                  </button>
                </div>
                {recommendations.length ? (
                  <div className="carousel">
                    {recommendations.slice(0, 12).map((m) =>
                      card(
                        games.find((g) => (g.steamId || g.catalogId) === (m.steamAppId||m.appId)),
                        m,
                      ),
                    )}
                  </div>
                ) : (
                  <div className="empty">
                    Discover games to build a cached catalog of recommendations.
                    <button onClick={() => navigate("All Games")}>
                      Browse Steam games
                    </button>
                  </div>
                )}
              </section>
            </>
          ) : page === "Steam Library" || page === "Library" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR COLLECTION</span>
                  <h1>{page}</h1>
                  <p>
                    {page === "Steam Library"
                      ? "Your verified Steam library, including installed and uninstalled games."
                      : "Owned games, local installations and saved discoveries."}
                  </p>
                </div>
                <div className="actions">
                  <button onClick={() => void call("importSteam")}>
                    Import Steam
                  </button>
                  <button
                    disabled={snap.busy}
                    onClick={() => void call("syncSteam")}
                  >
                    ↻ Refresh Steam
                  </button>
                </div>
              </div>
              {page === "Steam Library" && !state.ownership.steamId && (
                <div className="notice">
                  Connect your SteamID64 and Web API key in Settings to verify
                  ownership. Local manifests alone do not establish ownership.
                  <button onClick={() => navigate("Settings")}>
                    Connect Steam
                  </button>
                </div>
              )}
              {filters}
              <div className={"game-collection " + view}>
                {libraryGames.map((g) =>
                  card(g, g.steamId ? state.catalog[g.steamId] : undefined),
                )}
              </div>
              {!libraryGames.length && (
                <p className="empty">No games match this view.</p>
              )}
            </>
          ) : page === "All Games" ||
            page === "Coming Soon" ||
            page === "Top Sellers" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">STEAM DISCOVERY</span>
                  <h1>{page}</h1>
                  <p>
                    {page === "Coming Soon"
                      ? "Upcoming games and publisher release windows. Saving does not purchase a game."
                      : page === "Top Sellers"
                        ? "Steam public top-sellers order. Missing or excluded entries keep their original ranks."
                        : "Find your next favorite. Quality and content filters apply to every discovery page."}
                  </p>
                </div>
                {page === "Top Sellers" && (
                  <button
                    disabled={pending > 0}
                    onClick={() =>
                      void call("rankings", { refresh: true, offset: 0 })
                    }
                  >
                    ↻ Refresh ranking
                  </button>
                )}
              </div>
              {filters}
              {page === "Top Sellers" ? (
                <>
                  <div className="notice">
                    {state.rankings.source} · Region: {state.rankings.region} ·{" "}
                    {state.rankings.ids.length}/100 entries returned
                    <p>Fixed snapshot · Refresh reloads the supplied list and artwork.</p>
                    {state.rankings.error && (
                      <p>Cached results · {state.rankings.error}</p>
                    )}
                  </div>
                  <div className={"game-collection " + view}>
                    {state.rankings.ids.slice(0, rankLimit).map((id, index) => {
                      const m = state.catalog[id],
                        g = games.find((g) => g.steamId === (m?.steamAppId||id));
                      return m &&
                        quality(m, state.preferences) &&
                        filterMeta(m, g)
                        ? card(g, m, state.rankings.positions?.[id])
                        : null;
                    })}
                  </div>
                  <InfiniteLoader hasMore={rankLimit < state.rankings.ids.length} loading={pending>0} onLoad={async()=>{await call('rankings',{offset:rankLimit});setRankLimit(n=>n+20);}} />                </>
              ) : (
                <>
                  <p className="muted">
                    {sourceLabel} · Filters apply to games loaded on this device. Set review
                    thresholds in Settings.
                  </p>
                  <div className={"game-collection " + view}>
                    {discoveryGames
                      .filter((m) =>
                        filterMeta(
                          m,
                          gamesByCatalog.get(m.steamAppId||m.appId),
                        ),
                      )
                      .sort((a, b) =>
                        page === "Coming Soon" && sort === "name" ? (a.chartRank||0)-(b.chartRank||0) : ["name", "quality", "popularity", "release"].includes(
                          sort,
                        )
                          ? compareMeta(a, b)
                          : sort === "played"
                            ? playedSeconds(
                                games.find((g) => g.steamId === b.appId) ||
                                  ({ store: "steam" } as Game),
                              ) -
                              playedSeconds(
                                games.find((g) => g.steamId === a.appId) ||
                                  ({ store: "steam" } as Game),
                              )
                            : 0,
                      )
                      .map((m) =>
                        card(
                          gamesByCatalog.get(m.steamAppId||m.appId),
                          m,
                        ),
                      )}
                  </div>
                  {!discoveryGames.some(m=>filterMeta(m,gamesByCatalog.get(m.steamAppId||m.appId))) && !pending && (
                    <p className="empty">
                      No eligible games on this page. Try another search or load
                      the next page.
                    </p>
                  )}
                  {filteredDiscovery ? hasMore&&<button disabled={pending>0} onClick={()=>void loadMore().catch(()=>{})}>{pending>0?'Loading more games…':'Load more games'}</button> : <InfiniteLoader hasMore={hasMore} loading={pending>0} onLoad={loadMore}/>}                </>
              )}
            </>
          ) : page === "Downloads" ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    REAL TRANSFERS · VERIFIED PACKAGES
                  </span>
                  <h1>Downloads</h1>
                  <p>
                    Registered source packages only. Steam downloads are managed
                    in Steam.
                  </p>
                </div>
                <div className="actions">
                  <button
                    onClick={() =>
                      void call("downloadControl", { action: "pauseAll" })
                    }
                  >
                    Pause all
                  </button>
                  <button
                    onClick={() =>
                      void call("downloadControl", { action: "resumeAll" })
                    }
                  >
                    Resume all
                  </button>
                  <button onClick={() => void call("offlineInstaller")}>
                    Run offline installer
                  </button>
                </div>
              </div>
              <div className="stat-strip">
                <div>
                  <small>ACTIVE SPEED</small>
                  <b>
                    {bytes(state.downloads.reduce((s, j) => s + j.speed, 0))}/s
                  </b>
                </div>
                <div>
                  <small>QUEUED / ACTIVE</small>
                  <b>
                    {
                      state.downloads.filter((j) =>
                        [
                          "queued",
                          "connecting",
                          "downloading",
                          "verifying",
                        ].includes(j.status),
                      ).length
                    }
                  </b>
                </div>
                <div>
                  <small>CONCURRENT LIMIT</small>
                  <b>{state.preferences.concurrency}</b>
                </div>
              </div>
              {!state.downloads.length && (
                <div className="empty">
                  <h2>A clear runway</h2>
                  <p>
                    Add an authorized package feed in Settings, then choose a
                    game's download source.
                  </p>
                  <button onClick={() => navigate("Settings")}>
                    Manage sources
                  </button>
                </div>
              )}
              {state.downloads.map((j) => (
                <article className="download-card" key={j.id}>
                  <div className="section-heading">
                    {j.package.steamAppId && <div className="download-thumbnail"><GameCover title={j.package.title} sources={[state.catalog[j.package.steamAppId]?.cover,state.catalog[j.package.steamAppId]?.portrait,...steamCoverSources(j.package.steamAppId)]}/></div>}
                    <div>
                      <h2>{j.package.title}</h2>
                      <small>
                        {j.package.sourceName} · {j.package.version} ·{" "}
                        {j.package.platforms.join(" / ")}
                      </small>
                    </div>
                    <span className="pill">
                      {j.status}
                      {j.installedGameId ? " · Installed" : ""}
                    </span>
                  </div>
                  {j.status !== "external" && <progress value={j.total ? j.downloaded : undefined} max={j.total || 1} />}
                  <div className="download-metrics">
                    <span>
                      {bytes(j.downloaded)} / {bytes(j.total)} ·{" "}
                      {j.total ? ((j.downloaded / j.total) * 100).toFixed(1) + "%" : "Size pending"}
                    </span>
                    <span>
                      {bytes(j.speed)}/s · avg {bytes(j.averageSpeed)}/s
                    </span>
                    <span>
                      ETA{" "}
                      {j.eta !== undefined
                        ? Math.ceil(j.eta / 60) + " min"
                        : "—"}
                    </span>
                  </div>
                  {j.error && <p role="alert">{j.error}</p>}
                  {j.package.transport === "torrent" && ["connecting", "downloading"].includes(j.status) && <p role="status">{j.peers ?? 0} connected peers · {j.discovery || "Starting peer discovery…"}</p>}
                  {j.package.transport && <p className="muted">{j.package.transport === "host" ? "Complete the host page steps in the Ember download window. Progress appears once the file transfer starts." : "Torrent pieces are verified against the magnet hash. Finished files are not automatically installed; paused/canceled files remain in the download folder."}</p>}
                  {j.package.transport && <button onClick={()=>void call("openDownload",{id:j.id})}>{j.package.transport === "host" && j.status !== "completed" ? "Open download host" : "Open download folder"}</button>}
                  <div className="actions">
                    {[
                      "queued",
                      "connecting",
                      "downloading",
                      "verifying",
                    ].includes(j.status) && (
                      <button
                        onClick={() =>
                          void call("downloadControl", {
                            id: j.id,
                            action: "pause",
                          })
                        }
                      >
                        Pause
                      </button>
                    )}
                    {["paused", "failed", "canceled"].includes(j.status) && (
                      <button
                        onClick={() =>
                          void call("downloadControl", {
                            id: j.id,
                            action: "resume",
                          })
                        }
                      >
                        Resume / retry
                      </button>
                    )}
                    {![
                      "completed",
                      "canceled",
                      "installing",
                      "extracting",
                    ].includes(j.status) && (
                      <button
                        onClick={() =>
                          void call("downloadControl", {
                            id: j.id,
                            action: "cancel",
                          })
                        }
                      >
                        Cancel
                      </button>
                    )}
                    {j.status === "queued" && (
                      <button
                        onClick={() =>
                          void call("downloadControl", {
                            id: j.id,
                            action: "top",
                          })
                        }
                      >
                        Prioritize
                      </button>
                    )}
                    {j.status === "completed" && !j.package.transport && !j.installedGameId && (
                      <button
                        className="primary"
                        onClick={() =>
                          void call("installPackage", { id: j.id })
                        }
                      >
                        Install verified package
                      </button>
                    )}
                    {["completed", "failed", "canceled", "external"].includes(j.status) && (
                      <button
                        onClick={() =>
                          void call("downloadControl", {
                            id: j.id,
                            action: "remove",
                          })
                        }
                      >
                        Remove download
                      </button>
                    )}
                  </div>
                  <details>
                    <summary>Package details</summary>
                    <p>
                      {j.package.authorization.license} ·{" "}
                      {j.package.authorization.distribution}
                    </p>
                    <p>Destination: {j.destination}</p>
                    {j.package.sha256 && <code>SHA-256: {j.package.sha256}</code>}
                    <p>
                      Created {new Date(j.created).toLocaleString()} · Started{" "}
                      {j.started
                        ? new Date(j.started).toLocaleString()
                        : "Not started"}
                    </p>
                    {j.installedGameId && (
                      <button
                        onClick={() =>
                          void call("reveal", { id: j.installedGameId })
                        }
                      >
                        Open installation folder
                      </button>
                    )}
                  </details>
                </article>
              ))}
            </>
          ) : page === "Settings" ? (
            <Settings snap={snap} call={call} admin={user.role==='admin'} />
          ) : null}
        </div>
        <footer className="v2-footer">
          Ember {displayVersion} · Native games, thoughtfully together
          {snap.message && !snap.busy && <span>{snap.message}</span>}
        </footer>
      </main>
      {sources && <SourcePicker sources={state.sources} appId={selectedMeta?.origin?undefined:game?.steamId || selectedMeta?.steamAppId || selectedMeta?.appId} title={selectedMeta?.title || game?.name || "Game"} platform={snap.platform} onClose={()=>setSources(false)} onManage={()=>{setSources(false);navigate("Settings")}} onRefresh={async()=>{await call("syncSources")}} onChoose={async(s,p)=>{
        const id=await call("download",{sourceId:s.id,packageId:p.id,appId:game?.steamId||selectedMeta?.steamAppId||selectedMeta?.appId});
        if(id){setSources(false);if(p.transport==='host')await call("openDownload",{id});}
      }}/>}
      {edit && (
        <div className="modal-backdrop">
          <form
            className="v2-modal"
            onSubmit={(e) => {
              e.preventDefault();
              void call("updateGame", edit).then(() => setEdit(undefined));
            }}
          >
            <h2>Edit game</h2>
            <label>
              Name
              <input
                value={edit.name}
                required
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={edit.description}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </label>
            <label>
              Launch arguments (one per line)
              <textarea
                value={edit.args.join("\n")}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    args: e.target.value ? e.target.value.split("\n") : [],
                  })
                }
              />
            </label>
            <div className="actions">
              <button type="submit" className="primary">
                Save
              </button>
              <button type="button" onClick={() => setEdit(undefined)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function Settings({
  snap,
  call,
  admin,
}: {
  admin:boolean;
  snap: V2Snapshot;
  call: (action: V2Action, p?: any) => Promise<any>;
}) {
  const [prefs, setPrefs] = useState<Preferences>(snap.state.preferences),
    [steamId, setSteamId] = useState(snap.state.ownership.steamId || ""),
    [key, setKey] = useState(""),
    [url, setUrl] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="settings-panel">
        <h2>Steam account</h2>
        <p>
          Verify owned games with Steam's official Web API. Your key is
          encrypted using this device's credential storage. Never enter your
          Steam password.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void call("connectSteam", { steamId, key }).then(() => setKey(""));
          }}
        >
          <label>
            SteamID64
            <input
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="17-digit SteamID64"
              required
            />
          </label>
          <label>
            Steam Web API key
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button className="primary">Verify & connect</button>
            {snap.state.ownership.steamId && (
              <button
                type="button"
                onClick={() => void call("disconnectSteam")}
              >
                Disconnect
              </button>
            )}
          </div>
        </form>
        <p>
          {snap.state.ownership.updated
            ? "Verified " +
              new Date(snap.state.ownership.updated).toLocaleString() +
              " · " +
              snap.state.ownership.ids.length +
              " owned entries"
            : "No verified account connected."}
        </p>
        {snap.state.ownership.error && (
          <p className="alert">{snap.state.ownership.error}</p>
        )}
      </section>
      <form
        className="settings-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void call("preferences", prefs);
        }}
      >
        <h2>Discovery & downloads</h2>
        <div className="settings-grid">
          <label>
            Store region (ISO country code)
            <input
              maxLength={2}
              value={prefs.region}
              onChange={(e) =>
                setPrefs({ ...prefs, region: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Concurrent downloads
            <select
              value={prefs.concurrency}
              onChange={(e) =>
                setPrefs({ ...prefs, concurrency: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum positive reviews (%)
            <input
              type="number"
              min={0}
              max={100}
              value={prefs.minimumPositive}
              onChange={(e) =>
                setPrefs({ ...prefs, minimumPositive: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Apply rating filter after this review count
            <input
              type="number"
              min={0}
              max={1000000}
              value={prefs.minimumReviews}
              onChange={(e) =>
                setPrefs({ ...prefs, minimumReviews: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Optional permitted catalog index (HTTPS)
          <input
            placeholder="Leave empty to use Steam public search"
            value={prefs.catalogUrl}
            onChange={(e) => setPrefs({ ...prefs, catalogUrl: e.target.value })}
          />
        </label>
        <p>
          Low-review games remain eligible. Adult titles and entries without
          content classifications are included. Review filters still apply.
        </p>
        <button className="primary">Save preferences</button>
      </form>
      <SourceSettings sources={snap.state.sources} call={call}/>
      {snap.launcherUpdate&&<section className="settings-panel"><h2>Launcher updates</h2><p>Installed version: {snap.launcherUpdate.currentVersion}</p><p>{snap.launcherUpdate.supported?'Ember checks for published releases at startup and every 15 minutes.':snap.launcherUpdate.reason}</p>{snap.launcherUpdate.error&&<p role="alert">{snap.launcherUpdate.error}</p>}<button disabled={!snap.launcherUpdate.supported||['checking','downloading','downloaded','installing'].includes(snap.launcherUpdate.phase)} onClick={()=>void call('checkLauncherUpdate')}>{snap.launcherUpdate.phase==='checking'?'Checking…':'Check for launcher updates'}</button></section>}
      <section className="settings-panel">
        <h2>Platform & storage</h2>
        <p>
          {snap.platform === "darwin"
            ? "macOS native applications only. Intel Mac applications may require Apple Rosetta. Windows-only games are blocked."
            : "Windows native applications. Steam installation and authentication remain managed by Steam."}
        </p>
        <p>Data: {snap.dataPath}</p>
        <small>
          Steam Deck ratings describe Steam Deck compatibility, not Mac
          compatibility. Performance is not inferred from a game's rating.
        </small>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<AccountGate>{(user,logout)=><App user={user} logout={logout}/>}</AccountGate>);




