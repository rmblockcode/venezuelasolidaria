"use client";

import { useCallback, useEffect, useState } from "react";
import { GalleryPhoto } from "../../lib/types";
import { fetchGallery } from "../../lib/api";
import { addGalleryPhoto, deleteGalleryPhoto, UnauthorizedError } from "../../lib/adminApi";
import ImageUpload from "../../components/ImageUpload";

export default function AdminGallery({ onLogout }: { onLogout: () => void }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPhotos(await fetchGallery());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setError("");
    if (!image) return setError("Sube una imagen primero.");
    setSaving(true);
    const res = await addGalleryPhoto(image, caption.trim());
    setSaving(false);
    if (!res.ok) return setError(res.error || "No se pudo agregar.");
    setImage("");
    setCaption("");
    load();
  }

  async function remove(id: number) {
    setBusyId(id);
    try {
      await deleteGalleryPhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      if (e instanceof UnauthorizedError) return onLogout();
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-gallery">
      <div className="admin-userform">
        <p className="admin-geocode-desc">
          Sube fotos relevantes para el carrusel de la portada. Se pasan solas y se pueden deslizar.
        </p>
        <ImageUpload value={image} onChange={setImage} />
        <input
          className="admin-search"
          style={{ marginTop: 10 }}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Texto / pie de foto (opcional)"
        />
        <div style={{ marginTop: 10 }}>
          <button className="btn-submit" onClick={add} disabled={saving || !image}>
            {saving ? "Agregando…" : "Agregar a la galería"}
          </button>
        </div>
        {error && <div className="img-error">{error}</div>}
      </div>

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : photos.length === 0 ? (
        <p className="admin-activity-empty">Aún no hay fotos en la galería.</p>
      ) : (
        <div className="gallery-grid">
          {photos.map((p) => (
            <div key={p.id} className="gallery-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.caption || ""} />
              {p.caption && <span className="gallery-cap">{p.caption}</span>}
              <button
                className="gallery-del"
                onClick={() => remove(p.id)}
                disabled={busyId === p.id}
                aria-label="Eliminar"
                title="Eliminar"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
