const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a YYYY-MM-DD string (the value produced by <input type="date">). */
export function isIsoDate(value?: string | null): value is string {
  return !!value && ISO_DATE.test(value.trim());
}

/**
 * Render an ISO date (YYYY-MM-DD) as a short Spanish date, e.g. "sáb 28 jun".
 * Non-ISO / legacy free-text values are returned unchanged.
 */
export function formatEventDate(value?: string | null): string {
  if (!value) return "";
  if (!isIsoDate(value)) return value;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const weekday = d.toLocaleDateString("es", { weekday: "short" }).replace(".", "");
  const month = d.toLocaleDateString("es", { month: "short" }).replace(".", "");
  return `${weekday} ${d.getDate()} ${month}`;
}

/** Tiempo relativo en español desde una fecha ISO, p. ej. "hace 5 min", "hace 2 h",
 *  "hace 3 días". Vacío si la fecha falta o es inválida. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const secs = Math.floor((Date.now() - t) / 1000);
  if (secs < 0) return "hace un momento";
  if (secs < 60) return "hace un momento";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

/** "sáb 28 jun – dom 29 jun" when an end date exists, otherwise just the start. */
export function formatEventRange(start?: string | null, end?: string | null): string {
  const s = formatEventDate(start);
  if (!s) return "";
  const e = formatEventDate(end);
  return e && e !== s ? `${s} – ${e}` : s;
}
