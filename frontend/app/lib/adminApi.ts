import { Resource } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";
const TOKEN_KEY = "vzla-admin-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Thrown when the server replies 401 — the caller should send the user back to login. */
export class UnauthorizedError extends Error {}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    clearToken();
    throw new UnauthorizedError("Sesión inválida o expirada.");
  }
  return res;
}

export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "No se pudo iniciar sesión." };
  setToken(data.token);
  return { ok: true };
}

export interface AdminResource extends Resource {
  contact?: string | null;
  created_at?: string | null;
}

export async function fetchSubmissions(status = "pending"): Promise<AdminResource[]> {
  const res = await authFetch(`/api/admin/submissions?status=${encodeURIComponent(status)}`);
  if (!res.ok) throw new Error("No se pudieron cargar los envíos.");
  const data = await res.json();
  return data.items as AdminResource[];
}

export async function approve(id: string, verified: boolean): Promise<void> {
  const res = await authFetch(`/api/admin/submissions/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verified }),
  });
  if (!res.ok) throw new Error("No se pudo aprobar.");
}

export async function reject(id: string): Promise<void> {
  const res = await authFetch(`/api/admin/submissions/${id}/reject`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo rechazar.");
}

export interface AdminUserDTO {
  id: number;
  email: string;
  created_at?: string | null;
  isSelf?: boolean;
}

export async function listAdmins(): Promise<AdminUserDTO[]> {
  const res = await authFetch(`/api/admin/admins`);
  if (!res.ok) throw new Error("No se pudieron cargar los administradores.");
  const data = await res.json();
  return data.items as AdminUserDTO[];
}

export async function createAdmin(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await authFetch(`/api/admin/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "No se pudo crear el administrador." };
  return { ok: true };
}

export async function deleteAdmin(id: number): Promise<void> {
  const res = await authFetch(`/api/admin/admins/${id}/delete`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo eliminar el administrador.");
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await authFetch(`/api/admin/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "No se pudo cambiar la contraseña." };
  return { ok: true };
}

export async function geocodeMissing(): Promise<{ updated: number; scanned: number }> {
  const res = await authFetch(`/api/admin/geocode-missing`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo rellenar las ubicaciones.");
  }
  const data = await res.json();
  return { updated: data.updated ?? 0, scanned: data.scanned ?? 0 };
}

export async function addGalleryPhoto(
  image: string,
  caption: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await authFetch(`/api/admin/gallery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, caption }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "No se pudo agregar la foto." };
  return { ok: true };
}

export async function deleteGalleryPhoto(id: number): Promise<void> {
  const res = await authFetch(`/api/admin/gallery/${id}/delete`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo eliminar la foto.");
}

export interface ActivityEntry {
  id: number;
  admin: string | null;
  action: "approve" | "reject" | "unpublish" | string;
  title: string | null;
  category: string | null;
  created_at: string | null;
}

export async function fetchActivity(): Promise<ActivityEntry[]> {
  const res = await authFetch(`/api/admin/activity`);
  if (!res.ok) throw new Error("No se pudo cargar la actividad.");
  const data = await res.json();
  return data.items as ActivityEntry[];
}

export async function purge(id: string): Promise<void> {
  const res = await authFetch(`/api/admin/submissions/${id}/purge`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo eliminar definitivamente.");
}

export async function unpublish(id: string): Promise<void> {
  const res = await authFetch(`/api/admin/submissions/${id}/unpublish`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo despublicar.");
}

/** Partial update — works on pending or published entries. */
export async function patchSubmission(
  id: string,
  fields: Partial<AdminResource>
): Promise<AdminResource> {
  const res = await authFetch(`/api/admin/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("No se pudo guardar.");
  const data = await res.json();
  return data.item as AdminResource;
}
