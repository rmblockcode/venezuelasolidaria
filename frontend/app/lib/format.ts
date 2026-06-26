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

/** "sáb 28 jun – dom 29 jun" when an end date exists, otherwise just the start. */
export function formatEventRange(start?: string | null, end?: string | null): string {
  const s = formatEventDate(start);
  if (!s) return "";
  const e = formatEventDate(end);
  return e && e !== s ? `${s} – ${e}` : s;
}
