"use client";

import { useEffect, useRef, useState } from "react";
import { NetworkRecord } from "../lib/types";
import { REC_TYPES, REC_ORDER, REC_PLURAL } from "../lib/constants";
import { fetchNetwork, fetchNetworkRecent, fetchNetworkSources } from "../lib/api";
import { timeAgo } from "../lib/format";
import { cloudinaryFill } from "../lib/cloudinary";
import RecIcon from "./RecIcon";
import NetModal from "./NetModal";

const PAGE = 24;

export default function NetworkSearch() {
  const [q, setQ] = useState("");
  const [type, setType] = useState(""); // "" = todos los tipos
  const [items, setItems] = useState<NetworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sources, setSources] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selected, setSelected] = useState<NetworkRecord | null>(null);
  const offset = useRef(0);
  const reqId = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNetworkSources()
      .then((r) => {
        setSources(r.count);
        setLastSync(r.lastSync);
      })
      .catch(() => {});
  }, []);

  // Prefill desde ?q= (al llegar con un término desde el buscador de la portada).
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial);
  }, []);

  async function run(reset: boolean) {
    const my = ++reqId.current;
    if (reset) {
      setLoading(true);
      setError("");
      offset.current = 0;
    } else {
      setLoadingMore(true);
    }
    try {
      const browsing = !q.trim() && !type;
      if (browsing) {
        // Sin búsqueda activa: mostramos lo añadido recientemente en toda la red.
        const recent = await fetchNetworkRecent(PAGE);
        if (my !== reqId.current) return;
        setItems(recent);
        setTotal(null);
        setHasMore(false);
      } else {
        const res = await fetchNetwork({
          q: q.trim(),
          record_type: type,
          limit: PAGE,
          offset: offset.current,
        });
        if (my !== reqId.current) return;
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setTotal(res.total_matches);
        offset.current += res.items.length;
        setHasMore(res.pagination.has_more);
      }
    } catch (e) {
      if (my !== reqId.current) return;
      setError(e instanceof Error ? e.message : "No se pudo consultar la red.");
    } finally {
      if (my === reqId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  // Búsqueda con debounce al cambiar el texto o el tipo (también la carga inicial).
  useEffect(() => {
    const t = setTimeout(() => run(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type]);

  // Scroll infinito: carga la siguiente página cuando el centinela entra en viewport.
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) run(false);
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, loadingMore, items.length]);

  return (
    <>
      <section className="net-head wrap">
        <h1>Buscar en la red humanitaria</h1>
        <p className="net-lead">
          Una sola búsqueda sobre muchas fuentes de Venezuela: personas desaparecidas, localizadas y
          hospitalizadas, centros de acopio y donación, y recursos. Cada resultado enlaza a su fuente
          original — verifica siempre allí.
        </p>
        <p className="net-attrib">
          Datos del{" "}
          <a href="https://redayuda.eriktaveras.com" target="_blank" rel="noopener noreferrer">
            índice común de la Red Humanitaria de Datos
          </a>
          {sources > 0 && <> · {sources} fuentes conectadas</>}
          {timeAgo(lastSync) && <> · actualizado {timeAgo(lastSync)}</>} ·{" "}
          <a href="/contribuciones">ver contribuciones</a>
        </p>
      </section>

      <section className="net-tools wrap">
        <div className="searchbox net-searchbox">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, cédula, centro de acopio, ciudad…"
            aria-label="Buscar en la red"
          />
        </div>

        <div className="chips net-chips">
          <button
            className="chip"
            style={chipStyle(type === "", "var(--brand)")}
            onClick={() => setType("")}
          >
            Todos
          </button>
          {REC_ORDER.map((rt) => (
            <button
              key={rt}
              className="chip"
              style={chipStyle(type === rt, REC_TYPES[rt].color)}
              onClick={() => setType((t) => (t === rt ? "" : rt))}
            >
              {REC_PLURAL[rt]}
            </button>
          ))}
        </div>

        <div className="net-statline">
          {loading
            ? "Buscando…"
            : total != null
            ? `${total.toLocaleString("es")} resultado(s) en la red`
            : items.length > 0
            ? "Añadidos recientemente"
            : ""}
        </div>
      </section>

      <section className="net-results wrap">
        {loading ? (
          <div className="loading">Consultando la red…</div>
        ) : error ? (
          <div className="empty">
            <p className="t">No se pudo consultar la red.</p>
            <p className="d">{error}</p>
            <button onClick={() => run(true)}>Reintentar</button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p className="t">Sin resultados.</p>
            <p className="d">Prueba con otro nombre, ciudad o tipo.</p>
          </div>
        ) : (
          <>
            <div className="net-grid">
              {items.map((r) => (
                <NetCard key={`${r.source_id}:${r.id}`} r={r} onOpen={setSelected} />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinel} className="scroll-sentinel">
                <span className="dots" aria-hidden />
                Cargando más…
              </div>
            )}
          </>
        )}
      </section>

      {selected && <NetModal record={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function NetCard({ r, onOpen }: { r: NetworkRecord; onOpen: (r: NetworkRecord) => void }) {
  const t = REC_TYPES[r.record_type] || REC_TYPES.otro;
  const [imgError, setImgError] = useState(false);
  const showImage = !!r.image_url && !imgError;
  const place = [r.location_name || r.city, r.state, r.country].filter(Boolean).join(" · ");
  const meta = [place, typeof r.age === "number" ? `${r.age} años` : ""].filter(Boolean).join(" · ");
  // El estado solo se muestra si aporta algo (no si repite el tipo).
  const status = r.status && r.status.toLowerCase() !== t.label.toLowerCase() ? r.status : "";
  return (
    <article
      className="net-card net-card-click"
      style={{ "--cat": t.color } as React.CSSProperties}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(r);
        }
      }}
      title="Ver detalle"
    >
      <div className="net-cover-wrap">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryFill(r.image_url, 600, 360)}
            alt=""
            className="net-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          // Sin foto: portada generada por tipo (degradado del color + icono).
          <div className="net-cover net-cover-ph" aria-hidden>
            <RecIcon k={r.record_type} size={42} />
          </div>
        )}
        <span className="net-cover-tag">{t.label}</span>
        {status && <span className="net-cover-status">{status}</span>}
      </div>

      <div className="net-card-body">
        <h3>{r.title}</h3>
        {meta && <p className="net-place">{meta}</p>}
        {r.summary && <p className="net-sum">{r.summary}</p>}
        {r.cedula_masked && <p className="net-ced">C.I. {r.cedula_masked}</p>}
        <div className="net-card-foot">
          {r.source_url ? (
            <a
              className="net-source"
              href={r.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Fuente: {r.source_name || "ver origen"} ↗
            </a>
          ) : (
            <span className="net-source muted">Fuente: {r.source_name || "—"}</span>
          )}
          <span className="net-detail">Ver detalle →</span>
        </div>
      </div>
    </article>
  );
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  if (active) return { border: `1px solid ${color}`, background: color, color: "#fff" };
  return {};
}
