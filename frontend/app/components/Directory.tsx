"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryKey, Resource, ThemeKey } from "../lib/types";
import { CATS, CAT_ORDER, THEME_LABELS, THEME_ORDER } from "../lib/constants";
import { fetchResources } from "../lib/api";
import { useEventStream } from "../lib/useEventStream";
import { isIsoDate } from "../lib/format";
import Card from "./Card";
import AddModal from "./AddModal";

const THEME_KEY = "vzla-dir-theme";

export default function Directory() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [theme, setTheme] = useState<ThemeKey>("esperanza");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CategoryKey | "todos">("todos");
  const [pais, setPais] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showAdd, setShowAdd] = useState(false);

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

  // restore theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as ThemeKey | null;
      if (saved && THEME_LABELS[saved]) setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function changeTheme(t: ThemeKey) {
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: resources.length };
    CAT_ORDER.forEach((k) => (c[k] = resources.filter((r) => r.category === k).length));
    return c;
  }, [resources]);

  const verifiedCount = useMemo(() => resources.filter((r) => r.verified).length, [resources]);

  const countryChips = useMemo(() => {
    const items = resources.filter((r) => r.category === "quedadas");
    const countries: string[] = [];
    items.forEach((r) => {
      if (r.country && !countries.includes(r.country)) countries.push(r.country);
    });
    const c: Record<string, number> = { todos: items.length };
    countries.forEach((co) => (c[co] = items.filter((r) => r.country === co).length));
    return { countries, counts: c };
  }, [resources]);

  const dateActive = !!(desde || hasta);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter(
      (r) =>
        (cat === "todos" || r.category === cat) &&
        (cat !== "quedadas" || pais === "todos" || r.country === pais) &&
        (!q ||
          `${r.title} ${r.desc} ${r.city || ""} ${r.country || ""}`.toLowerCase().includes(q)) &&
        (!dateActive || matchesDateRange(r, desde, hasta))
    );
  }, [resources, query, cat, pais, desde, hasta, dateActive]);

  return (
    <div data-theme={theme}>
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
          <div className="themeswitch">
            <span>Estilo</span>
            <div className="opts">
              {THEME_ORDER.map((t) => (
                <button
                  key={t}
                  className={`theme-btn${theme === t ? " active" : ""}`}
                  onClick={() => changeTheme(t)}
                >
                  {THEME_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-add-top" onClick={() => setShowAdd(true)}>
            + Agregar
          </button>
        </div>
      </header>

      <section className="hero wrap">
        <div style={{ maxWidth: 740 }}>
          <h1>Toda la ayuda para Venezuela, en un solo lugar.</h1>
          <p className="lede">
            Un directorio centralizado de recaudaciones, contactos de emergencia, páginas creadas
            por la comunidad y jornadas solidarias tras los sismos. Una sola dirección, todo
            verificado por la gente.
          </p>
        </div>

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
            Todos ({counts.todos || 0})
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
              {CATS[k].label} ({counts[k] || 0})
            </button>
          ))}
        </div>

        {cat === "quedadas" && (
          <div className="countryrow">
            <span className="lbl">Por país:</span>
            <button
              className="chip"
              style={chipStyle(pais === "todos", "#2f8a6b")}
              onClick={() => setPais("todos")}
            >
              Todos los países ({countryChips.counts.todos || 0})
            </button>
            {countryChips.countries.map((co) => (
              <button
                key={co}
                className="chip"
                style={chipStyle(pais === co, "#2f8a6b")}
                onClick={() => setPais(co)}
              >
                {co} ({countryChips.counts[co] || 0})
              </button>
            ))}
          </div>
        )}

        <div className="datefilter">
          <span className="lbl">Fecha:</span>
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
          {dateActive && (
            <button
              className="clear"
              onClick={() => {
                setDesde("");
                setHasta("");
              }}
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="statline">
          <span className="strong">{list.length} recursos</span>
          <span className="dot">·</span>
          <span>{verifiedCount} verificados</span>
          <span className="dot">·</span>
          <span>
            Verifica siempre antes de donar. La marca ✓ significa revisado por el equipo.
          </span>
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
        ) : (
          <div className="grid">
            {list.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
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
          <div>
            <div className="h">Reportar un enlace</div>
            <p>
              ¿Viste algo sospechoso o desactualizado?{" "}
              <a href="mailto:reportes@ejemplo.org">Avísanos aquí</a> y lo revisamos.
            </p>
          </div>
          <div>
            <div className="h">Aviso</div>
            <p>
              Demostración del directorio. Varios enlaces son de ejemplo: verifica siempre antes de
              donar o compartir datos.
            </p>
          </div>
        </div>
      </footer>

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
