"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CategoryKey, Resource } from "../lib/types";
import { CATS, CAT_ORDER } from "../lib/constants";
import { fetchResources } from "../lib/api";
import { useEventStream } from "../lib/useEventStream";
import { isIsoDate } from "../lib/format";
import { Timeframe, TIMEFRAMES, timeframeRange } from "../lib/timeframes";
import Card from "./Card";
import ListItem from "./ListItem";
import HeroGallery from "./HeroGallery";
import AddModal from "./AddModal";
import Carousel from "./Carousel";
import CatIcon from "./CatIcon";

// Cantidad de tarjetas que se cargan por tanda al hacer scroll (infinite scroll).
const CHUNK = 12;
// Máximo de tarjetas por carrusel de categoría en la portada (el resto, en "Ver todas").
const ROW_MAX = 12;

// Leaflet needs `window`, so the map is client-only.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="loading">Cargando mapa…</div>,
});

export default function Directory() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CategoryKey | "todos">("todos");
  const [pais, setPais] = useState("todos");
  const [timeframe, setTimeframe] = useState<Timeframe>("semana");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [visible, setVisible] = useState(CHUNK);
  const [view, setView] = useState<"tarjetas" | "lista" | "mapa">("tarjetas");
  const [showAdd, setShowAdd] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const items = await fetchResources();
      setResources(items);
      setLoadError("");
    } catch (e) {
      if (!silent) setLoadError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Live updates: refresh the directory when published entries change.
  useEventStream((scopes) => {
    if (scopes.includes("published")) load(true);
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: resources.length };
    CAT_ORDER.forEach((k) => (c[k] = resources.filter((r) => r.category === k).length));
    return c;
  }, [resources]);

  const verifiedCount = useMemo(() => resources.filter((r) => r.verified).length, [resources]);

  // Country filter, available across all categories — built from whatever
  // countries exist in the currently selected category.
  const countryChips = useMemo(() => {
    const items = resources.filter((r) => cat === "todos" || r.category === cat);
    const countries: string[] = [];
    items.forEach((r) => {
      if (r.country && !countries.includes(r.country)) countries.push(r.country);
    });
    countries.sort((a, b) => a.localeCompare(b, "es"));
    const c: Record<string, number> = { todos: items.length };
    countries.forEach((co) => (c[co] = items.filter((r) => r.country === co).length));
    return { countries, counts: c };
  }, [resources, cat]);

  const [fDesde, fHasta] = timeframe === "rango" ? [desde, hasta] : timeframeRange(timeframe);
  const dateActive = !!(fDesde || fHasta);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter(
      (r) =>
        (cat === "todos" || r.category === cat) &&
        (pais === "todos" || r.country === pais) &&
        (!q ||
          `${r.title} ${r.desc} ${r.city || ""} ${r.country || ""}`.toLowerCase().includes(q)) &&
        // The date filter only narrows dated events; undated resources always show.
        (!dateActive || !isIsoDate(r.date) || matchesDateRange(r, fDesde, fHasta))
    );
  }, [resources, query, cat, pais, fDesde, fHasta, dateActive]);

  const shown = list.slice(0, visible);
  const hasMore = visible < list.length;
  const locatedCount = list.filter(
    (i) => typeof i.lat === "number" && typeof i.lng === "number"
  ).length;

  // Portada estilo Booking/Airbnb: mientras el usuario no acote la búsqueda,
  // mostramos "slides" por categoría en vez de una sola grilla.
  const browsing = view === "tarjetas" && cat === "todos" && pais === "todos" && !query.trim();
  const grouped = useMemo(
    () => CAT_ORDER.map((k) => ({ k, items: list.filter((r) => r.category === k) })).filter((g) => g.items.length),
    [list]
  );
  const featured = useMemo(() => list.filter((r) => r.verified).slice(0, 10), [list]);

  const filtersActive =
    cat !== "todos" ||
    pais !== "todos" ||
    timeframe !== "semana" ||
    query.trim() !== "" ||
    desde !== "" ||
    hasta !== "";

  function clearFilters() {
    setCat("todos");
    setPais("todos");
    setTimeframe("semana");
    setQuery("");
    setDesde("");
    setHasta("");
  }

  // Reset to the first tanda whenever the filters or view change.
  useEffect(() => {
    setVisible(CHUNK);
  }, [query, cat, pais, timeframe, desde, hasta, view]);

  // Infinite scroll: load the next tanda when the sentinel enters the viewport.
  useEffect(() => {
    if (view === "mapa" || !hasMore) return;
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => v + CHUNK);
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // `visible` is included so the observer re-checks after each tanda loads
    // (if the sentinel is still on screen, the next tanda loads too).
  }, [view, hasMore, list.length, visible]);

  return (
    <div data-theme="esperanza">
      <div className="flagbar">
        <div style={{ background: "#f6c945" }} />
        <div style={{ background: "#1f6fb0" }} />
        <div style={{ background: "#cf3a2e" }} />
      </div>

      <header className="site">
        <div className="wrap inner">
          <div className="brand">
            <div className="ticks">
              <span style={{ background: "#f6c945" }} />
              <span style={{ background: "#1f6fb0" }} />
              <span style={{ background: "#cf3a2e" }} />
            </div>
            <div className="names">
              <span className="n1">Venezuela Solidaria</span>
              <span className="n2">Directorio de ayuda · Sismos 2026</span>
            </div>
          </div>
          <div className="spacer" />
          <Link href="/api-docs" className="header-link">
            API
          </Link>
          <button className="btn-add-top" onClick={() => setShowAdd(true)}>
            + Agregar enlace
          </button>
        </div>
      </header>

      <section className="hero">
        <HeroGallery>
          <h1>Toda la ayuda para Venezuela, en un solo lugar.</h1>
          <p className="lede">
            Un directorio centralizado de recaudaciones, contactos de emergencia, páginas creadas
            por la comunidad y jornadas solidarias tras los sismos. Una sola dirección, todo
            verificado por la gente.
          </p>
        </HeroGallery>

        <div className="wrap hero-tools">
        <div className="searchrow">
          <div className="searchbox">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, ciudad o palabra clave…"
            />
          </div>
          <button className="btn-add-hero" onClick={() => setShowAdd(true)}>
            + Agregar enlace
          </button>
        </div>

        <div className="chips">
          <button
            className="chip"
            style={chipStyle(cat === "todos", "var(--brand)")}
            onClick={() => {
              setCat("todos");
              setPais("todos");
            }}
          >
            <CatIcon k="todos" size={16} className="chip-ic" />
            Todos <span className="chip-n">({counts.todos || 0})</span>
          </button>
          {CAT_ORDER.map((k) => (
            <button
              key={k}
              className="chip"
              style={chipStyle(cat === k, CATS[k].color)}
              onClick={() => {
                setCat(k);
                setPais("todos");
              }}
            >
              <CatIcon k={k} size={16} className="chip-ic" />
              {CATS[k].label} <span className="chip-n">({counts[k] || 0})</span>
            </button>
          ))}
        </div>

        <div className="filterbar">
          {countryChips.countries.length > 0 && (
            <label className="filter-field">
              <span className="lbl">País</span>
              <select value={pais} onChange={(e) => setPais(e.target.value)}>
                <option value="todos">Todos ({countryChips.counts.todos || 0})</option>
                {countryChips.countries.map((co) => (
                  <option key={co} value={co}>
                    {co} ({countryChips.counts[co] || 0})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="filter-field">
            <span className="lbl">Fecha</span>
            <div className="seg">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  className={timeframe === tf.key ? "active" : ""}
                  onClick={() => setTimeframe(tf.key)}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {timeframe === "rango" && (
            <span className="daterange">
              <input
                type="date"
                aria-label="Desde"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
              />
              <span className="sep">–</span>
              <input
                type="date"
                aria-label="Hasta"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => setHasta(e.target.value)}
              />
            </span>
          )}

          {filtersActive && (
            <button className="filter-clear" onClick={clearFilters}>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="statbar">
          <div className="statline">
            <span className="strong">{list.length} recursos</span>
            <span className="dot">·</span>
            <span>{verifiedCount} verificados</span>
            <span className="dot">·</span>
            <span>Verifica siempre antes de donar. La marca ✓ significa revisado por el equipo.</span>
          </div>
          <div className="statbar-controls">
            <div className="viewtoggle">
            <button
              className={view === "tarjetas" ? "active" : ""}
              onClick={() => setView("tarjetas")}
            >
              ▦ Tarjetas
            </button>
            <button
              className={view === "lista" ? "active" : ""}
              onClick={() => setView("lista")}
            >
              ☰ Lista
            </button>
            <button
              className={view === "mapa" ? "active" : ""}
              onClick={() => setView("mapa")}
            >
              ◎ Mapa
            </button>
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="grid-sec wrap">
        {loading ? (
          <div className="loading">Cargando directorio…</div>
        ) : loadError ? (
          <div className="empty">
            <p className="t">No se pudo cargar el directorio.</p>
            <p className="d">{loadError}</p>
            <button onClick={() => load()}>Reintentar</button>
          </div>
        ) : list.length === 0 ? (
          <div className="empty">
            <p className="t">No encontramos resultados.</p>
            <p className="d">
              ¿Conoces un enlace o jornada que falte? Ayúdanos a completar el directorio.
            </p>
            <button onClick={() => setShowAdd(true)}>+ Agregar enlace</button>
          </div>
        ) : view === "mapa" ? (
          locatedCount === 0 ? (
            <div className="empty">
              <p className="t">Sin ubicaciones para mostrar</p>
              <p className="d">Ninguno de estos recursos tiene una ubicación reconocible.</p>
            </div>
          ) : (
            <>
              <MapView items={list} />
              {locatedCount < list.length && (
                <p className="map-note">
                  {list.length - locatedCount} recurso(s) sin ubicación no aparecen en el mapa.
                </p>
              )}
            </>
          )
        ) : view === "lista" ? (
          <>
            <div className="dir-list">
              {shown.map((item) => (
                <ListItem key={item.id} item={item} />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinel} className="scroll-sentinel">
                <span className="dots" aria-hidden />
                Cargando más…
              </div>
            )}
          </>
        ) : browsing ? (
          // Portada: "slides" por categoría (estilo Booking/Airbnb).
          <div className="rows">
            {featured.length > 2 && (
              <Carousel title="Destacados" count={featured.length}>
                {featured.map((item) => (
                  <Card key={`f-${item.id}`} item={item} />
                ))}
              </Carousel>
            )}
            {grouped.map((g) => (
              <Carousel
                key={g.k}
                title={CATS[g.k].label}
                icon={<CatIcon k={g.k} size={20} />}
                count={g.items.length}
                onSeeAll={g.items.length > ROW_MAX ? () => setCat(g.k) : undefined}
                seeAllLabel="Ver todas"
              >
                {g.items.slice(0, ROW_MAX).map((item) => (
                  <Card key={`${g.k}-${item.id}`} item={item} />
                ))}
              </Carousel>
            ))}
          </div>
        ) : (
          <>
            <div className="grid">
              {shown.map((item) => (
                <Card key={item.id} item={item} />
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

      <footer className="site">
        <div className="wrap inner">
          <div>
            <div className="h lead">Venezuela Solidaria</div>
            <p>
              Un directorio comunitario para centralizar la ayuda tras los sismos. Hecho por
              venezolanos, para venezolanos.
            </p>
          </div>
          <div>
            <div className="h">Cómo verificamos</div>
            <p>
              Cada envío se revisa antes de publicarse. Confirmamos que el enlace funcione, que la
              campaña sea real y que no esté duplicada.
            </p>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 Venezuela Solidaria · Ayuda humanitaria, sin fines de lucro.</span>
          <span className="footer-links">
            <Link href="/api-docs">API</Link>
            <Link href="/privacidad">Política de privacidad</Link>
          </span>
        </div>
      </footer>

      <button
        className="fab"
        onClick={() => setShowAdd(true)}
        aria-label="Agregar enlace"
        title="Agregar enlace"
      >
        +
      </button>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSubmitted={() => {
            /* submission is pending review; no immediate refresh needed */
          }}
        />
      )}
    </div>
  );
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  if (active) return { border: `1px solid ${color}`, background: color, color: "#fff" };
  return {};
}

/**
 * True when an item's event interval [start, end||start] overlaps the filter
 * range [desde, hasta]. Items without an ISO start date never match a date filter.
 */
function matchesDateRange(item: Resource, desde: string, hasta: string): boolean {
  if (!isIsoDate(item.date)) return false;
  const start = item.date;
  const end = isIsoDate(item.dateEnd) ? item.dateEnd : start;
  return (!desde || end >= desde) && (!hasta || start <= hasta);
}
