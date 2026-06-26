"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CategoryKey } from "../../lib/types";
import { CATS, CAT_ORDER } from "../../lib/constants";
import {
  AdminResource,
  approve,
  clearToken,
  fetchSubmissions,
  patchSubmission,
  purge,
  reject,
  unpublish,
  UnauthorizedError,
} from "../../lib/adminApi";
import { useEventStream } from "../../lib/useEventStream";
import { formatEventRange } from "../../lib/format";
import AdminEditModal from "./AdminEditModal";
import AdminUsers from "./AdminUsers";
import AdminPassword from "./AdminPassword";
import AdminActivity from "./AdminActivity";
import AdminGeocode from "./AdminGeocode";
import AdminGallery from "./AdminGallery";
import Pagination from "../../components/Pagination";

type ResourceTab = "pending" | "published" | "rejected";
type Tab = ResourceTab | "admins" | "galeria";
type VerFilter = "todos" | "si" | "no";
const PAGE_SIZE = 10;

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<AdminResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyFlags, setVerifyFlags] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminResource | null>(null);

  // filters + pagination
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryKey | "todos">("todos");
  const [verFilter, setVerFilter] = useState<VerFilter>("todos");
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (which: ResourceTab, silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const data = await fetchSubmissions(which);
        setItems(data);
        if (which === "pending") {
          setVerifyFlags((prev) =>
            Object.fromEntries(data.map((i) => [i.id, prev[i.id] ?? true]))
          );
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) return onLogout();
        if (!silent) setError(e instanceof Error ? e.message : "Error al cargar.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [onLogout]
  );

  const isResourceTab = tab === "pending" || tab === "published" || tab === "rejected";

  useEffect(() => {
    if (isResourceTab) load(tab);
  }, [load, tab, isResourceTab]);

  // Live updates: refresh the active tab when its scope changes on the server.
  useEventStream((scopes) => {
    if (isResourceTab && scopes.includes(tab)) load(tab, true);
  });

  function handleError(e: unknown, fallback: string) {
    if (e instanceof UnauthorizedError) return onLogout();
    setError(e instanceof Error ? e.message : fallback);
  }

  async function run(id: string, fn: () => Promise<void>, fallback: string) {
    setBusyId(id);
    try {
      await fn();
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      handleError(e, fallback);
    } finally {
      setBusyId(null);
    }
  }

  const onApprove = (id: string) =>
    run(id, () => approve(id, verifyFlags[id] ?? true), "Error al aprobar.");
  const onReject = (id: string) => run(id, () => reject(id), "Error al rechazar.");
  const onUnpublish = (id: string) => run(id, () => unpublish(id), "Error al despublicar.");
  const onArchive = (id: string) => run(id, () => reject(id), "Error al eliminar.");
  const onPurge = (id: string) => run(id, () => purge(id), "Error al eliminar definitivamente.");

  async function toggleVerified(item: AdminResource, value: boolean) {
    setBusyId(item.id);
    try {
      const updated = await patchSubmission(item.id, { verified: value });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      handleError(e, "Error al actualizar.");
    } finally {
      setBusyId(null);
    }
  }

  function logout() {
    clearToken();
    onLogout();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (catFilter !== "todos" && i.category !== catFilter) return false;
      if (tab === "published" && verFilter !== "todos") {
        if (verFilter === "si" && !i.verified) return false;
        if (verFilter === "no" && i.verified) return false;
      }
      if (
        q &&
        !`${i.title} ${i.desc} ${i.city || ""} ${i.country || ""} ${i.contact || ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [items, search, catFilter, verFilter, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtering = search.trim() !== "" || catFilter !== "todos" || verFilter !== "todos";

  // Reset to page 1 when the tab or any filter changes.
  useEffect(() => {
    setPage(1);
  }, [tab, search, catFilter, verFilter]);

  // Keep page in range after live updates / filtering shrink the list.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const title =
    tab === "admins"
      ? "Administradores"
      : tab === "galeria"
      ? "Galería de portada"
      : tab === "pending"
      ? "Envíos pendientes"
      : tab === "rejected"
      ? "Rechazados"
      : "Publicados";
  const subtitle =
    tab === "admins"
      ? "Gestiona quién puede moderar"
      : tab === "galeria"
      ? "Fotos del carrusel de la home"
      : loading
      ? "Cargando…"
      : filtering
      ? `${filtered.length} de ${items.length}`
      : tab === "pending"
      ? `${items.length} por revisar`
      : tab === "rejected"
      ? `${items.length} archivados`
      : `${items.length} en el directorio`;

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <h1>{title}</h1>
          <p className="sub">{subtitle}</p>
        </div>
        <div className="admin-head-actions">
          {isResourceTab && (
            <button className="ghost" onClick={() => load(tab)} disabled={loading}>
              Actualizar
            </button>
          )}
          <button className="ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab${tab === "pending" ? " active" : ""}`}
          onClick={() => setTab("pending")}
        >
          Pendientes
        </button>
        <button
          className={`admin-tab${tab === "published" ? " active" : ""}`}
          onClick={() => setTab("published")}
        >
          Publicados
        </button>
        <button
          className={`admin-tab${tab === "rejected" ? " active" : ""}`}
          onClick={() => setTab("rejected")}
        >
          Rechazados
        </button>
        <button
          className={`admin-tab${tab === "galeria" ? " active" : ""}`}
          onClick={() => setTab("galeria")}
        >
          Galería
        </button>
        <button
          className={`admin-tab${tab === "admins" ? " active" : ""}`}
          onClick={() => setTab("admins")}
        >
          Administradores
        </button>
      </div>

      {tab === "galeria" && <AdminGallery onLogout={onLogout} />}

      {tab === "admins" && (
        <div className="admin-sections">
          <section>
            <div className="admin-section-head">
              <h2>Administradores</h2>
            </div>
            <AdminUsers onLogout={onLogout} />
          </section>
          <section>
            <div className="admin-section-head">
              <h2>Cambiar mi contraseña</h2>
            </div>
            <AdminPassword />
          </section>
          <section>
            <div className="admin-section-head">
              <h2>Ubicaciones del mapa</h2>
            </div>
            <AdminGeocode onLogout={onLogout} />
          </section>
          <AdminActivity onLogout={onLogout} />
        </div>
      )}

      {isResourceTab && (
      <>
      <div className="admin-filters">
        <input
          className="admin-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, ciudad, país o contacto…"
        />
        <div className="admin-chips">
          <button
            className="chip"
            style={chip(catFilter === "todos", "var(--brand)")}
            onClick={() => setCatFilter("todos")}
          >
            Todos
          </button>
          {CAT_ORDER.map((k) => (
            <button
              key={k}
              className="chip"
              style={chip(catFilter === k, CATS[k].color)}
              onClick={() => setCatFilter(k)}
            >
              {CATS[k].label}
            </button>
          ))}
        </div>
        {tab === "published" && (
          <select
            className="admin-verselect"
            value={verFilter}
            onChange={(e) => setVerFilter(e.target.value as VerFilter)}
          >
            <option value="todos">Todas</option>
            <option value="si">✓ Verificadas</option>
            <option value="no">Sin verificar</option>
          </select>
        )}
      </div>

      {error && <div className="err">{error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="admin-empty">
          <p className="t">
            {tab === "pending"
              ? "Todo al día ✓"
              : tab === "rejected"
              ? "Nada rechazado"
              : "Aún no hay publicados"}
          </p>
          <p className="d">
            {tab === "pending"
              ? "No hay envíos pendientes de revisión."
              : tab === "rejected"
              ? "Los envíos que rechaces se archivan aquí y puedes recuperarlos."
              : "Los recursos aprobados aparecerán aquí."}
          </p>
        </div>
      )}

      {!loading && items.length > 0 && filtered.length === 0 && !error && (
        <div className="admin-empty">
          <p className="t">Sin resultados</p>
          <p className="d">Ningún registro coincide con los filtros.</p>
        </div>
      )}

      <div className="admin-list">
        {pageItems.map((item) => {
          const c = CATS[item.category];
          const meta = [item.city, item.country, formatEventRange(item.date, item.dateEnd)]
            .filter(Boolean)
            .join("  ·  ");
          return (
            <div
              key={item.id}
              className="admin-row"
              style={{ "--cat": c.color } as React.CSSProperties}
            >
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="admin-thumb" loading="lazy" />
              )}
              <div className="admin-row-main">
                <div className="admin-row-top">
                  <span className="tag">{c.label}</span>
                  {tab === "published" &&
                    (item.verified ? (
                      <span className="verified">✓ Verificado</span>
                    ) : (
                      <span className="unverified">Sin verificar</span>
                    ))}
                  {meta && <span className="admin-meta">{meta}</span>}
                </div>
                <h3>{item.title}</h3>
                {item.desc && <p className="admin-desc">{item.desc}</p>}
                <div className="admin-fields">
                  {(item.url || item.phone) && (
                    <span>
                      <strong>Destino:</strong>{" "}
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.url}
                        </a>
                      ) : (
                        item.phone
                      )}
                    </span>
                  )}
                  {item.contact && (
                    <span>
                      <strong>Contacto:</strong> {item.contact}
                    </span>
                  )}
                  {item.created_at && (
                    <span>
                      <strong>Enviado:</strong> {new Date(item.created_at).toLocaleString("es")}
                    </span>
                  )}
                </div>
              </div>

              <div className="admin-row-actions">
                {tab === "pending" || tab === "rejected" ? (
                  <>
                    <label className="verify-toggle">
                      <input
                        type="checkbox"
                        checked={verifyFlags[item.id] ?? true}
                        onChange={(e) =>
                          setVerifyFlags((f) => ({ ...f, [item.id]: e.target.checked }))
                        }
                      />
                      Marcar verificado ✓
                    </label>
                    <div className="admin-btns">
                      <button
                        className="approve"
                        onClick={() => onApprove(item.id)}
                        disabled={busyId === item.id}
                      >
                        Aprobar
                      </button>
                      <button
                        className="edit"
                        onClick={() => setEditing(item)}
                        disabled={busyId === item.id}
                      >
                        Editar
                      </button>
                      {tab === "pending" ? (
                        <button
                          className="reject"
                          onClick={() => onReject(item.id)}
                          disabled={busyId === item.id}
                        >
                          Rechazar
                        </button>
                      ) : (
                        <button
                          className="delete"
                          onClick={() => onPurge(item.id)}
                          disabled={busyId === item.id}
                        >
                          Eliminar definitivamente
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="verify-toggle">
                      <input
                        type="checkbox"
                        checked={!!item.verified}
                        disabled={busyId === item.id}
                        onChange={(e) => toggleVerified(item, e.target.checked)}
                      />
                      Verificado ✓
                    </label>
                    <div className="admin-btns">
                      <button
                        className="edit"
                        onClick={() => setEditing(item)}
                        disabled={busyId === item.id}
                      >
                        Editar
                      </button>
                      <button
                        className="reject"
                        onClick={() => onUnpublish(item.id)}
                        disabled={busyId === item.id}
                      >
                        Despublicar
                      </button>
                      <button
                        className="delete"
                        onClick={() => onArchive(item.id)}
                        disabled={busyId === item.id}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </>
      )}

      {editing && (
        <AdminEditModal
          item={editing}
          onClose={() => setEditing(null)}
          onUnauthorized={onLogout}
          onSaved={(updated) => {
            setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function chip(active: boolean, color: string): React.CSSProperties {
  if (active) return { border: `1px solid ${color}`, background: color, color: "#fff" };
  return {};
}
