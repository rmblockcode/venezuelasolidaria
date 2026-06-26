"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityEntry, fetchActivity, UnauthorizedError } from "../../lib/adminApi";
import { useEventStream } from "../../lib/useEventStream";

const ACTIONS: Record<string, { label: string; cls: string }> = {
  approve: { label: "aprobó", cls: "act-approve" },
  reject: { label: "rechazó", cls: "act-reject" },
  unpublish: { label: "despublicó", cls: "act-unpublish" },
  edit: { label: "editó", cls: "act-edit" },
  delete: { label: "eliminó definitivamente", cls: "act-reject" },
  admin_add: { label: "agregó al administrador", cls: "act-approve" },
  admin_remove: { label: "eliminó al administrador", cls: "act-reject" },
  password: { label: "cambió su contraseña", cls: "act-edit" },
  gallery_add: { label: "agregó a la galería", cls: "act-approve" },
  gallery_remove: { label: "quitó de la galería", cls: "act-reject" },
  geocode: { label: "rellenó ubicaciones", cls: "act-edit" },
};

export default function AdminActivity({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setItems(await fetchActivity());
        setError("");
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
    load();
  }, [load]);

  // Live refresh whenever a moderation action changes a list on the server.
  useEventStream(() => load(true));

  return (
    <div className="admin-activity">
      <div className="admin-section-head">
        <h2>Auditoría</h2>
        <button className="ghost" onClick={() => load()} disabled={loading}>
          Actualizar
        </button>
      </div>

      {error && <div className="err">{error}</div>}

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : items.length === 0 ? (
        <p className="admin-activity-empty">Aún no hay actividad de moderación.</p>
      ) : (
        <ul className="activity-list">
          {items.map((it) => {
            const a = ACTIONS[it.action] || { label: it.action, cls: "" };
            return (
              <li key={it.id} className="activity-row">
                <span className="activity-text">
                  <strong>{it.admin || "—"}</strong> <span className={a.cls}>{a.label}</span>
                  {it.title ? <> «{it.title}»</> : ""}
                </span>
                {it.created_at && (
                  <span className="activity-time">
                    {new Date(it.created_at).toLocaleString("es")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
