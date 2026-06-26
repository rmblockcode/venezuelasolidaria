"use client";

import { useCallback, useEffect, useState } from "react";
import { CATS } from "../../lib/constants";
import {
  AdminResource,
  approve,
  clearToken,
  fetchSubmissions,
  patchSubmission,
  reject,
  unpublish,
  UnauthorizedError,
} from "../../lib/adminApi";
import { useEventStream } from "../../lib/useEventStream";
import { formatEventRange } from "../../lib/format";
import AdminEditModal from "./AdminEditModal";

type Tab = "pending" | "published";

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState<AdminResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyFlags, setVerifyFlags] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminResource | null>(null);

  const load = useCallback(
    async (which: Tab, silent = false) => {
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

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  // Live updates: refresh the active tab when its scope changes on the server.
  useEventStream((scopes) => {
    if (scopes.includes(tab)) load(tab, true);
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
  const onDelete = (id: string) => run(id, () => reject(id), "Error al eliminar.");

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

  const title = tab === "pending" ? "Envíos pendientes" : "Publicados";
  const subtitle = loading
    ? "Cargando…"
    : tab === "pending"
    ? `${items.length} por revisar`
    : `${items.length} en el directorio`;

  return (
    <div className="admin-wrap">
      <header className="admin-head">
        <div>
          <h1>{title}</h1>
          <p className="sub">{subtitle}</p>
        </div>
        <div className="admin-head-actions">
          <button className="ghost" onClick={() => load(tab)} disabled={loading}>
            Actualizar
          </button>
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
      </div>

      {error && <div className="err">{error}</div>}

      {!loading && items.length === 0 && !error && (
        <div className="admin-empty">
          <p className="t">{tab === "pending" ? "Todo al día ✓" : "Aún no hay publicados"}</p>
          <p className="d">
            {tab === "pending"
              ? "No hay envíos pendientes de revisión."
              : "Los recursos aprobados aparecerán aquí."}
          </p>
        </div>
      )}

      <div className="admin-list">
        {items.map((item) => {
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
                {tab === "pending" ? (
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
                      <button
                        className="reject"
                        onClick={() => onReject(item.id)}
                        disabled={busyId === item.id}
                      >
                        Rechazar
                      </button>
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
                        onClick={() => onDelete(item.id)}
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
