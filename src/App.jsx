import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_BASE = "https://solana-terminal-backend-s0v8.onrender.com";

/** ---------- utils ---------- */
function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}
function fmtUsdCompact(n) {
  const x = num(n);
  if (x === null) return "-";
  const abs = Math.abs(x);
  const sign = x < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
function fmtPrice(n) {
  const x = num(n);
  if (x === null) return "-";
  if (x === 0) return "$0";
  if (x < 0.000001) return "$" + x.toFixed(10);
  if (x < 0.01) return "$" + x.toFixed(8);
  return "$" + x.toFixed(6);
}
function age(msEpoch) {
  const t = num(msEpoch);
  if (!t) return "-";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/** ---------- UI building blocks ---------- */
function Pill({ children, tone = "muted" }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

function Stat({ label, value, tone = "neutral" }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className={`stat__value stat__value--${tone}`}>{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card card--skeleton">
      <div className="sk sk__row">
        <div className="sk sk__title" />
        <div className="sk sk__chip" />
      </div>
      <div className="sk sk__sub" />
      <div className="sk sk__grid">
        <div className="sk sk__box" />
        <div className="sk sk__box" />
        <div className="sk sk__box" />
      </div>
      <div className="sk sk__foot">
        <div className="sk sk__mini" />
        <div className="sk sk__mini" />
      </div>
    </div>
  );
}

function PairCard({ p, onCopyCA }) {
  const symbol = p?.baseToken?.symbol || "???";
  const name = p?.baseToken?.name || "";
  const ca = p?.baseToken?.address || "";
  const url = p?.url;

  const price = fmtPrice(p?.priceUsd);
  const liq = fmtUsdCompact(p?.liquidityUsd ?? 0);
  const v5 = fmtUsdCompact(p?.volume?.m5 ?? 0);

  const ch5 = num(p?.priceChange?.m5);
  const chTone = ch5 === null ? "neutral" : (ch5 >= 0 ? "pos" : "neg");
  const chText = ch5 === null ? "-" : `${ch5 >= 0 ? "+" : ""}${ch5.toFixed(2)}%`;

  const buys = p?.txns?.m5?.buys ?? 0;
  const sells = p?.txns?.m5?.sells ?? 0;

  // tiny “heat” signal just for UI vibes (not a real score)
  const heat = clamp((num(p?.volume?.m5) ?? 0) / 5000, 0, 1);

  return (
    <div className="card">
      <div className="card__top">
        <div className="card__id">
          <div className="card__symbol">{symbol}</div>
          <div className="card__name" title={name}>{name}</div>
        </div>

        <div className="card__actions">
          <button
            className="btn btn--ghost"
            onClick={() => onCopyCA(ca)}
            title="Copy CA"
          >
            Copy CA
          </button>
          <a className="btn btn--ghost" href={url} target="_blank" rel="noreferrer" title="Open Dexscreener">
            Dex ↗
          </a>
        </div>
      </div>

      <div className="card__meta">
        <Pill>pump.fun</Pill>
        <Pill tone="muted">age {age(p?.firstSeenAt)}</Pill>
        <Pill tone="muted">SOL</Pill>
        <div className="heat" title="Activity (UI)">
          <div className="heat__bar" style={{ width: `${heat * 100}%` }} />
        </div>
      </div>

      <div className="card__grid">
        <Stat label="Price" value={price} />
        <Stat label="Liquidity" value={liq} />
        <Stat label="5m" value={chText} tone={chTone} />
      </div>

      <div className="card__foot">
        <div className="foot__item">Vol 5m: <span className="foot__strong">{v5}</span></div>
        <div className="foot__item">
          TXNs 5m: <span className="foot__strong">{buys}/{sells}</span>
        </div>
      </div>
    </div>
  );
}

function Column({ title, subtitle, rightTag, children }) {
  return (
    <div className="col">
      <div className="col__head">
        <div className="col__headLeft">
          <div className="col__title">{title}</div>
          <div className="col__sub">{subtitle}</div>
        </div>
        {rightTag ? <div className="col__tag">{rightTag}</div> : null}
      </div>
      <div className="col__body">{children}</div>
    </div>
  );
}

/** ---------- main app ---------- */
export default function App() {
  const [pairs, setPairs] = useState([]);
  const [status, setStatus] = useState("Loading");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const toastTimer = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }

  async function copyCA(ca) {
    if (!ca) return showToast("No CA");
    try {
      await navigator.clipboard.writeText(ca);
      showToast("Copied!");
    } catch {
      showToast("Copy blocked");
    }
  }

  async function load() {
    try {
      const h = await fetch(`${API_BASE}/api/health`).then(r => r.json());
      setStatus(h?.degraded ? "Degraded" : "Live");

      const d = await fetch(`${API_BASE}/api/new-pairs?limit=180`).then(r => r.json());
      setPairs(d?.pairs || []);
    } catch {
      setStatus("Error");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // 20s per ridurre rate limit
    return () => clearInterval(t);
  }, []);

  const pumpfunAll = useMemo(() => {
    const list = (pairs || []).filter(p => (p?.dexId || "").toLowerCase() === "pumpfun");
    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter(p => {
      const sym = (p?.baseToken?.symbol || "").toLowerCase();
      const nam = (p?.baseToken?.name || "").toLowerCase();
      const addr = (p?.baseToken?.address || "").toLowerCase();
      return sym.includes(q) || nam.includes(q) || addr.includes(q);
    });
  }, [pairs, query]);

  // Column splits (UI-first heuristics)
const newList = useMemo(() => {
  const now = Date.now();
  const fresh = pumpfunAll
    .slice()
    .sort((a, b) => (b?.firstSeenAt ?? 0) - (a?.firstSeenAt ?? 0));

  const last2min = fresh.filter(p => (now - (p.firstSeenAt ?? 0)) <= 2 * 60 * 1000);

  return (last2min.length ? last2min : fresh).slice(0, 22);
}, [pumpfunAll]);

  // “Bonding/Soon” proxy: super early + low liq, slightly active
const bondingList = useMemo(() => {
  return pumpfunAll
    .slice()
    .filter(p => (num(p?.liquidityUsd) ?? 0) <= 2500)
    .sort((a, b) => (b?.volume?.m5 ?? 0) - (a?.volume?.m5 ?? 0))
    .slice(0, 22);
}, [pumpfunAll]);


  // Migrated placeholder: for UI now we show “not available yet”
  // Later we’ll implement real pumpfun migrated detection in backend.
  const migratedList = useMemo(() => {
    return []; // UI-first: keep column ready, fill later from backend
  }, []);

  const isLoading = status === "Loading";

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__logo">⚡</div>
            <div className="brand__text">
              <div className="brand__title">TERMINAL</div>
              <div className="brand__sub">Solana • pump.fun only</div>
            </div>
          </div>

          <nav className="nav">
            <a className="nav__item nav__item--active" href="#">Trenches</a>
            <a className="nav__item" href="#">New</a>
            <a className="nav__item" href="#">Watchlist</a>
          </nav>

          <div className="topbar__right">
            <div className="search">
              <span className="search__icon">⌕</span>
              <input
                className="search__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name / symbol / CA..."
              />
              {query ? (
                <button className="search__clear" onClick={() => setQuery("")} title="Clear">
                  ×
                </button>
              ) : null}
            </div>

            <div className={`status status--${status.toLowerCase()}`}>
              <span className="status__dot" />
              {status}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main">
        <div className="grid">
          <Column
            title="New"
            subtitle="Fresh pump.fun pairs"
            rightTag={`${newList.length} shown`}
          >
            {isLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : (
              newList.map(p => <PairCard key={p.pairAddress} p={p} onCopyCA={copyCA} />)
            )}
          </Column>

          <Column
            title="Bonding"
            subtitle="Early / low liquidity (UI proxy)"
            rightTag="beta"
          >
            {isLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : (
              bondingList.map(p => <PairCard key={p.pairAddress} p={p} onCopyCA={copyCA} />)
            )}
          </Column>

          <Column
            title="Migrated"
            subtitle="Will be real with backend upgrade"
            rightTag="soon"
          >
            {isLoading ? (
              <>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </>
            ) : migratedList.length ? (
              migratedList.map(p => <PairCard key={p.pairAddress} p={p} onCopyCA={copyCA} />)
            ) : (
              <div className="empty">
                <div className="empty__title">Not wired yet</div>
                <div className="empty__sub">
                  UI is ready. Next step: backend will provide real “migrated” pump.fun tokens.
                </div>
              </div>
            )}
          </Column>
        </div>
      </main>

      {/* Toast */}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
