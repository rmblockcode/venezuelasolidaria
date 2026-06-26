"use client";

import { useState } from "react";
import { geocodeMissing, UnauthorizedError } from "../../lib/adminApi";

export default function AdminGeocode({ onLogout }: { onLogout: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setError("");
    setResult("");
    try {
      const { updated, scanned } = await geocodeMissing();
      setResult(
        scanned === 0
          ? "Todo al día: no hay ubicaciones pendientes."
          : `Actualizadas ${updated} de ${scanned} ubicaciones.`
      );
    } catch (e) {
      if (e instanceof UnauthorizedError) return onLogout();
      setError(e instanceof Error ? e.message : "No se pudo rellenar.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-userform">
      <p className="admin-geocode-desc">
        Calcula las coordenadas (a partir de ciudad/país) de los recursos publicados que aún no
        aparecen en el mapa. Puede tardar ~1 segundo por recurso.
      </p>
      <button className="btn-submit" onClick={run} disabled={running}>
        {running ? "Procesando…" : "Rellenar ubicaciones faltantes"}
      </button>
      {result && <div className="admin-ok">{result}</div>}
      {error && <div className="img-error">{error}</div>}
    </div>
  );
}
