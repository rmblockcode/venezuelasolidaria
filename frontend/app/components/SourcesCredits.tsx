"use client";

import { useEffect, useState } from "react";
import { NetworkSource, RecordType } from "../lib/types";
import { REC_TYPES, SOURCE_KINDS } from "../lib/constants";
import { fetchNetworkSources } from "../lib/api";

export default function SourcesCredits() {
  const [sources, setSources] = useState<NetworkSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNetworkSources()
      .then((s) => setSources([...s].sort((a, b) => (b.record_count || 0) - (a.record_count || 0))))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar."))
      .finally(() => setLoading(false));
  }, []);

  const total = sources.reduce((n, s) => n + (s.record_count || 0), 0);

  return (
    <section className="cred wrap">
      <h1>Contribuciones</h1>
      <p className="cred-lead">
        Venezuela Solidaria forma parte de una red abierta de datos humanitarios. La información que
        mostramos en <a href="/red">la búsqueda de la red</a> proviene del trabajo de muchas plataformas,
        equipos y voluntarios que abrieron sus datos para ayudar a encontrar personas y coordinar la ayuda
        tras los sismos. Gracias a cada una de estas fuentes. La etiqueta de cada tarjeta indica el tipo de
        datos que aporta.
      </p>
      <p className="cred-attrib">
        Agregadas por el{" "}
        <a href="https://redayuda.eriktaveras.com" target="_blank" rel="noopener noreferrer">
          índice común de la Red Humanitaria de Datos
        </a>
        {sources.length > 0 && (
          <>
            {" "}· {sources.length} fuentes · {total.toLocaleString("es")} registros
          </>
        )}
        .
      </p>

      {loading ? (
        <div className="loading">Cargando contribuciones…</div>
      ) : error ? (
        <div className="empty">
          <p className="t">No se pudieron cargar las fuentes.</p>
          <p className="d">{error}</p>
        </div>
      ) : (
        <ul className="cred-grid">
          {sources.map((s) => {
            const t = REC_TYPES[s.kind as RecordType] || REC_TYPES.otro;
            const kindLabel = SOURCE_KINDS[s.kind || "otro"] || SOURCE_KINDS.otro;
            return (
              <li key={s.id} className="cred-card" style={{ "--cat": t.color } as React.CSSProperties}>
                <div className="cred-top">
                  <span className="cred-tag">{kindLabel}</span>
                  {typeof s.record_count === "number" && (
                    <span className="cred-count">{s.record_count.toLocaleString("es")} registros</span>
                  )}
                </div>
                <h3>{s.name}</h3>
                {s.url && (
                  <a className="cred-link" href={s.url} target="_blank" rel="noopener noreferrer">
                    {prettyHost(s.url)} ↗
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="cred-foot">
        ¿Tu plataforma también aporta datos de ayuda y quieres aparecer aquí? Puedes sumarte a la red en{" "}
        <a href="https://redayuda.eriktaveras.com/desarrolladores" target="_blank" rel="noopener noreferrer">
          la sección de desarrolladores
        </a>
        .
      </p>
    </section>
  );
}

function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
