import {
  GalleryPhoto,
  NetworkRecord,
  NetworkSearchResult,
  NetworkSource,
  Resource,
  SubmissionForm,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

export async function fetchResources(): Promise<Resource[]> {
  const res = await fetch(`${API_BASE}/api/resources`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar el directorio (${res.status})`);
  const data = await res.json();
  return data.items as Resource[];
}

export async function fetchResource(id: string): Promise<Resource | null> {
  try {
    const res = await fetch(`${API_BASE}/api/resources/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Resource;
  } catch {
    return null;
  }
}

export async function fetchGallery(): Promise<GalleryPhoto[]> {
  const res = await fetch(`${API_BASE}/api/gallery`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items as GalleryPhoto[];
}

// ---- Red Humanitaria de Datos (vía nuestro proxy backend) ----
export interface NetworkQuery {
  q?: string;
  record_type?: string;
  city?: string;
  limit?: number;
  offset?: number;
}

export async function fetchNetwork(params: NetworkQuery): Promise<NetworkSearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.record_type) qs.set("record_type", params.record_type);
  if (params.city) qs.set("city", params.city);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const res = await fetch(`${API_BASE}/api/network/search?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`La red no está disponible (${res.status})`);
  return (await res.json()) as NetworkSearchResult;
}

export async function fetchNetworkRecent(limit = 24): Promise<NetworkRecord[]> {
  const res = await fetch(`${API_BASE}/api/network/recent?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`La red no está disponible (${res.status})`);
  const data = await res.json();
  return data.items as NetworkRecord[];
}

export async function fetchNetworkSourceCount(): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/api/network/sources`, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.count as number) || 0;
  } catch {
    return 0;
  }
}

export async function fetchNetworkSources(): Promise<NetworkSource[]> {
  const res = await fetch(`${API_BASE}/api/network/sources`, { cache: "no-store" });
  if (!res.ok) throw new Error(`La red no está disponible (${res.status})`);
  const data = await res.json();
  return data.items as NetworkSource[];
}

export interface SubmissionResult {
  ok: boolean;
  error?: string;
}

export async function submitResource(form: SubmissionForm): Promise<SubmissionResult> {
  const res = await fetch(`${API_BASE}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "No se pudo enviar. Intenta de nuevo." };
  return { ok: true };
}
