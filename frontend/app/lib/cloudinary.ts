const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

export const MAX_IMAGE_MB = 3;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"]; // jpg === image/jpeg

/** Returns an error message if the file is not an allowed image, else null. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Solo se permiten imágenes JPG o PNG.";
  if (file.size > MAX_IMAGE_BYTES) return `La imagen supera el límite de ${MAX_IMAGE_MB} MB.`;
  return null;
}

/** Uploads to Cloudinary (unsigned preset) and returns the secure URL. */
export async function uploadImage(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Falta configurar Cloudinary (NEXT_PUBLIC_CLOUDINARY_*).");
  }
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || "No se pudo subir la imagen.");
  }
  const data = await res.json();
  return data.secure_url as string;
}
