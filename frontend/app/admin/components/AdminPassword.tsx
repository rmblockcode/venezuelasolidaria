"use client";

import { useState } from "react";
import { changePassword } from "../../lib/adminApi";

export default function AdminPassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    if (next.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (next !== confirm) return setError("Las contraseñas nuevas no coinciden.");
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (!res.ok) return setError(res.error || "No se pudo cambiar la contraseña.");
    setOk(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <form className="admin-userform" onSubmit={submit}>
      <div className="admin-userform-fields">
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Contraseña actual"
          autoComplete="current-password"
          required
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Nueva (mín. 8)"
          autoComplete="new-password"
          required
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repetir nueva"
          autoComplete="new-password"
          required
        />
        <button className="btn-submit" type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Cambiar"}
        </button>
      </div>
      {error && <div className="img-error">{error}</div>}
      {ok && <div className="admin-ok">Contraseña actualizada ✓</div>}
    </form>
  );
}
