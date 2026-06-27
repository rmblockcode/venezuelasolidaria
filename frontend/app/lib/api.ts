import { GalleryPhoto, Resource, SubmissionForm } from "./types";

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
