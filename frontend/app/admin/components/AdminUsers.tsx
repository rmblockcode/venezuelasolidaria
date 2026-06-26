"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminUserDTO,
  createAdmin,
  deleteAdmin,
  listAdmins,
  UnauthorizedError,
} from "../../lib/adminApi";

export default function AdminUsers({ onLogout }: { onLogout: () => void }) {
  const [admins, setAdmins] = useState<AdminUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAdmins(await listAdmins());
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
    const res = await createAdmin(email.trim(), password);
    setSaving(false);
    if (!res.ok) return setFormError(res.error || "No se pudo crear.");
    setEmail("");
    setPassword("");
    load();
  }

  async function remove(a: AdminUserDTO) {
    if (busyId) return;
    setBusyId(a.id);
    setError("");
    try {
      await deleteAdmin(a.id);
      setAdmins((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      if (e instanceof UnauthorizedError) return onLogout();
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-users">
      <form className="admin-userform" onSubmit={add}>
        <div className="admin-userform-fields">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.org"
            autoComplete="off"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 8)"
            autoComplete="new-password"
            required
          />
          <button className="btn-submit" type="submit" disabled={saving}>
            {saving ? "Agregando…" : "Agregar admin"}
          </button>
        </div>
        {formError && <div className="img-error">{formError}</div>}
      </form>

      {error && <div className="err">{error}</div>}

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : (
        <div className="admin-userlist">
          {admins.map((a) => (
            <div key={a.id} className="admin-userrow">
              <div>
                <strong>{a.email}</strong>
                {a.isSelf && <span className="admin-youtag">tú</span>}
                {a.created_at && (
                  <span className="admin-userdate">
                    desde {new Date(a.created_at).toLocaleDateString("es")}
                  </span>
                )}
              </div>
              <button
                className="reject"
                onClick={() => remove(a)}
                disabled={a.isSelf || busyId === a.id}
                title={a.isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar"}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
