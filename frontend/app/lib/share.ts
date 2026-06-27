/** Path of a resource's shareable page. */
export function resourcePath(id: string): string {
  return `/recurso/${id}`;
}

/**
 * Shares a resource: uses the native share sheet when available (mobile),
 * otherwise copies the link to the clipboard. Returns true when the link was
 * copied (so the caller can show a "copied" hint).
 */
export async function shareResource(id: string, title: string): Promise<boolean> {
  const url =
    (typeof window !== "undefined" ? window.location.origin : "") + resourcePath(id);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user cancelled or share failed */
    }
    return false;
  }
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
