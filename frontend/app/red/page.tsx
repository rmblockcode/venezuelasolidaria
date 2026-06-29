import Link from "next/link";
import type { Metadata } from "next";
import NetworkSearch from "../components/NetworkSearch";

export const metadata: Metadata = {
  title: "Red Humanitaria · Buscar en la red · Venezuela Solidaria",
  description:
    "Busca en la Red Humanitaria de Datos: personas desaparecidas, localizadas y hospitalizadas, centros de acopio y donación, y recursos de muchas fuentes de Venezuela en un solo lugar.",
};

export default function RedPage() {
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

      <NetworkSearch />
    </div>
  );
}
