export type Timeframe = "todas" | "hoy" | "semana" | "mes" | "rango";

export const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "rango", label: "Rango" },
];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** [desde, hasta] ISO bounds for a preset. "todas"/"rango" return empty (handled by the caller). */
export function timeframeRange(tf: Timeframe): [string, string] {
  const now = new Date();
  if (tf === "hoy") {
    const t = iso(now);
    return [t, t];
  }
  if (tf === "semana") {
    const day = now.getDay(); // 0=Sun … 6=Sat
    const toMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + toMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [iso(mon), iso(sun)];
  }
  if (tf === "mes") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [iso(first), iso(last)];
  }
  return ["", ""];
}
