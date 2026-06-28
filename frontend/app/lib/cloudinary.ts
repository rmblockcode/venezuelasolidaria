const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

export const MAX_IMAGE_MB = 3;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"]; // jpg === image/jpeg

/**
 * Adapta una imagen a un recorte concreto. Si la URL es de Cloudinary inserta una
 * transformación de smart-crop (`c_fill,g_auto` enfoca el sujeto → no corta feo) con
 * tamaño y formato óptimos. Cualquier otra URL (CDN externo) se devuelve intacta.
 */
export function cloudinaryFill(url: string | null | undefined, w: number, h: number): string {
  if (!url) return "";
  const marker = "/image/upload/";
  const i = url.indexOf(marker);
  // Solo Cloudinary; y no duplicar si ya trae una transformación tras /upload/.
  if (!url.includes("res.cloudinary.com") || i === -1) return url;
  const after = url.slice(i + marker.length);
  if (/^[a-z]{1,3}_[^/]+\//i.test(after)) return url; // ya tiene transformación
  const t = `c_fill,g_auto,w_${w},h_${h},q_auto,f_auto`;
  return `${url.slice(0, i + marker.length)}${t}/${after}`;
}

/** Returns an error message if the file is not an allowed image, else null. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Solo se permiten imágenes JPG o PNG.";
  if (file.size > MAX_IMAGE_BYTES) return `La imagen supera el límite de ${MAX_IMAGE_MB} MB.`;
  return null;
}

interface SignaturePayload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder?: string | null;
}

/**
 * Signed upload: the browser asks our backend for a signature (the API secret
 * never leaves the server), then uploads the file directly to Cloudinary.
 * Returns the resulting secure URL.
 */
export async function uploadImage(file: File): Promise<string> {
  const sigRes = await fetch(`${API_BASE}/api/cloudinary/signature`, { method: "POST" });
  if (!sigRes.ok) {
    const data = await sigRes.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo preparar la subida de imagen.");
  }
  const sig = (await sigRes.json()) as SignaturePayload;

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", sig.apiKey);
  body.append("timestamp", String(sig.timestamp));
  body.append("signature", sig.signature);
  if (sig.folder) body.append("folder", sig.folder);

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  if (!upRes.ok) {
    const data = await upRes.json().catch(() => ({}));
    throw new Error(data?.error?.message || "No se pudo subir la imagen.");
  }
  const data = await upRes.json();
  return data.secure_url as string;
}
