import { CategoryKey, RecordType } from "./types";

export const CATS: Record<CategoryKey, { label: string; color: string; action: string }> = {
  donaciones: { label: "Donaciones", color: "#b07d18", action: "Donar ↗" },
  paginas: { label: "Directorios", color: "#2f6fb0", action: "Visitar ↗" },
  emergencia: { label: "Emergencia", color: "#c14b3a", action: "Llamar" },
  quedadas: { label: "Acopio", color: "#2f8a6b", action: "Ver detalles ↗" },
};

export const CAT_ORDER: CategoryKey[] = ["donaciones", "paginas", "emergencia", "quedadas"];

// ---- Tipos de registro de la Red Humanitaria de Datos (color/etiqueta por tipo) ----
export const REC_TYPES: Record<RecordType, { label: string; color: string }> = {
  persona_desaparecida: { label: "Desaparecida", color: "#b0543a" },
  persona_localizada: { label: "Localizada", color: "#2c7d59" },
  persona_hospitalizada: { label: "Hospitalizada", color: "#13496e" },
  centro_acopio: { label: "Acopio", color: "#2f8a6b" },
  centro_donacion: { label: "Donación", color: "#b07d18" },
  recurso: { label: "Recurso", color: "#2f6fb0" },
  otro: { label: "Otro", color: "#7c715d" },
};

// Etiqueta descriptiva del TIPO DE DATOS que aporta una fuente (no de un registro
// individual). Se usa en /contribuciones para no leer "DESAPARECIDA" en una plataforma.
export const SOURCE_KINDS: Record<string, string> = {
  persona_desaparecida: "Personas desaparecidas",
  persona_localizada: "Personas localizadas",
  persona_hospitalizada: "Personas hospitalizadas",
  centro_acopio: "Centros de acopio",
  centro_donacion: "Centros de donación",
  recurso: "Recursos",
  otro: "Datos de ayuda",
};

// Etiqueta en plural para los CHIPS de categoría (la categoría, no un registro
// individual). En la tarjeta seguimos usando REC_TYPES[].label.
export const REC_PLURAL: Record<RecordType, string> = {
  persona_desaparecida: "Desaparecidos",
  persona_localizada: "Localizados",
  persona_hospitalizada: "Hospitalizados",
  centro_acopio: "Acopios",
  centro_donacion: "Donaciones",
  recurso: "Recursos",
  otro: "Otros",
};

// Orden de los chips de filtro (las personas primero por relevancia humanitaria).
export const REC_ORDER: RecordType[] = [
  "persona_desaparecida",
  "persona_localizada",
  "persona_hospitalizada",
  "centro_acopio",
  "centro_donacion",
  "recurso",
];
