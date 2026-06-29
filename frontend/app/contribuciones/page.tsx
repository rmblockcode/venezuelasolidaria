import Link from "next/link";
import type { Metadata } from "next";
import SourcesCredits from "../components/SourcesCredits";

export const metadata: Metadata = {
  title: "Contribuciones · Venezuela Solidaria",
  description:
    "Las plataformas, equipos y voluntarios cuyas fuentes de datos hacen posible la búsqueda en la red humanitaria de Venezuela Solidaria.",
};

export default function ContribucionesPage() {
  return (
    <div data-theme="esperanza">
      <div className="flagbar">
        <div style={{ background: "#f6c945" }} />
        <div style={{ background: "#1f6fb0" }} />
        <div style={{ background: "#cf3a2e" }} />
      </div>

      <header className="legal-head wrap">
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
        <Link href="/" className="legal-back">
          ← Volver al directorio
        </Link>
      </header>

      <SourcesCredits />
    </div>
  );
}
