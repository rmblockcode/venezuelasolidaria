import { CategoryKey } from "./types";

export const CATS: Record<CategoryKey, { label: string; color: string; action: string }> = {
  donaciones: { label: "Donaciones", color: "#b07d18", action: "Donar ↗" },
  paginas: { label: "Directorios", color: "#2f6fb0", action: "Visitar ↗" },
  emergencia: { label: "Emergencia", color: "#c14b3a", action: "Llamar" },
  quedadas: { label: "Acopio", color: "#2f8a6b", action: "Ver detalles ↗" },
};

export const CAT_ORDER: CategoryKey[] = ["donaciones", "paginas", "emergencia", "quedadas"];
