"use client";

import { useState } from "react";
import { login } from "../../lib/adminApi";

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (!res.ok) return setError(res.error || "No se pudo iniciar sesión.");
    onSuccess();
  }

  return (
    <div className="admin-login">
      <form className="admin-card" onSubmit={submit}>
        <h1>Panel de moderación</h1>
        <p className="sub">Acceso restringido al equipo de Venezuela Solidaria.</p>

        <label>Correo</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@ejemplo.org"
          autoComplete="username"
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        {error && <div className="err">{error}</div>}

        <button className="btn-submit" type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
