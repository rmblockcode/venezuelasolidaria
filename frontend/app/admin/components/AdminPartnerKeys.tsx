"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PartnerKeyDTO,
  createPartnerKey,
  listPartnerKeys,
  revokePartnerKey,
  UnauthorizedError,
} from "../../lib/adminApi";

export default function AdminPartnerKeys({ onLogout }: { onLogout: () => void }) {
  const [keys, setKeys] = useState<PartnerKeyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // The plaintext key is shown exactly once, right after creation.
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setKeys(await listPartnerKeys());
    } catch (e) {
      if (e instanceof UnauthorizedError) return onLogout();
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    setNewKey(null);
    const res = await createPartnerKey(name.trim());
    setSaving(false);
    if (!res.ok || !res.key) return setFormError(res.error || "No se pudo crear.");
    setNewKey({ name: name.trim(), key: res.key });
    setName("");
    load();
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function revoke(k: PartnerKeyDTO) {
    if (busyId) return;
    setBusyId(k.id);
    setError("");
    try {
      await revokePartnerKey(k.id);
      setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, active: false } : x)));
    } catch (e) {
      if (e instanceof UnauthorizedError) return onLogout();
      setError(e instanceof Error ? e.message : "No se pudo revocar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-users">
      <p className="admin-geocode-desc">
        Claves que entregas a las apps de la red federada para que puedan publicar recursos
        (entran como pendientes). Se envían en el header <code>X-API-Key</code>.
      </p>

      <form className="admin-userform" onSubmit={add}>
        <div className="admin-userform-fields">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la app/socio (ej. AyudaVE)"
            autoComplete="off"
            required
          />
          <button className="btn-submit" type="submit" disabled={saving}>
            {saving ? "Generando…" : "Generar clave"}
          </button>
        </div>
        {formError && <div className="img-error">{formError}</div>}
      </form>

      {newKey && (
        <div className="apikey-reveal">
          <strong>Clave para «{newKey.name}»</strong>
          <p className="apikey-warn">
            Cópiala ahora: por seguridad no se vuelve a mostrar.
          </p>
          <div className="apikey-row">
            <code>{newKey.key}</code>
            <button className="btn-submit" type="button" onClick={copyKey}>
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="err">{error}</div>}

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : keys.length === 0 ? (
        <p className="admin-activity-empty">Aún no hay claves de API.</p>
      ) : (
        <div className="admin-userlist">
          {keys.map((k) => (
            <div key={k.id} className="admin-userrow">
              <div>
                <strong>{k.name}</strong>
                <span className="admin-userdate">{k.prefix}••••</span>
                {!k.active && <span className="admin-youtag">revocada</span>}
                {k.created_at && (
                  <span className="admin-userdate">
                    desde {new Date(k.created_at).toLocaleDateString("es")}
                  </span>
                )}
                {k.last_used_at && (
                  <span className="admin-userdate">
                    último uso {new Date(k.last_used_at).toLocaleDateString("es")}
                  </span>
                )}
              </div>
              <button
                className="reject"
                onClick={() => revoke(k)}
                disabled={!k.active || busyId === k.id}
                title={k.active ? "Revocar" : "Ya revocada"}
              >
                {k.active ? "Revocar" : "Revocada"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
