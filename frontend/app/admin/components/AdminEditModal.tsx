"use client";

import { useEffect, useState } from "react";
import { CategoryKey } from "../../lib/types";
import { CATS, CAT_ORDER } from "../../lib/constants";
import { AdminResource, patchSubmission, UnauthorizedError } from "../../lib/adminApi";
import ImageUpload from "../../components/ImageUpload";

export default function AdminEditModal({
  item,
  onClose,
  onSaved,
  onUnauthorized,
}: {
  item: AdminResource;
  onClose: () => void;
  onSaved: (updated: AdminResource) => void;
  onUnauthorized: () => void;
}) {
  const [category, setCategory] = useState<CategoryKey>(item.category);
  const [title, setTitle] = useState(item.title ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [phone, setPhone] = useState(item.phone ?? "");
  const [desc, setDesc] = useState(item.desc ?? "");
  const [city, setCity] = useState(item.city ?? "");
  const [country, setCountry] = useState(item.country ?? "");
  const [date, setDate] = useState(item.date ?? "");
  const [dateEnd, setDateEnd] = useState(item.dateEnd ?? "");
  const [image, setImage] = useState(item.image ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) return setError("El título es obligatorio.");
    if (date && dateEnd && dateEnd < date)
      return setError("La fecha de fin no puede ser anterior a la de inicio.");
    setSaving(true);
    try {
      const updated = await patchSubmission(item.id, {
        category,
        title,
        url,
        phone,
        desc,
        city,
        country,
        date,
        dateEnd,
        image,
      });
      onSaved(updated);
    } catch (e) {
      if (e instanceof UnauthorizedError) return onUnauthorized();
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="head">
          <div style={{ flex: 1 }}>
            <h2>Editar recurso</h2>
            <p>Los cambios se guardan de inmediato.</p>
          </div>
          <button className="x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <label className="cat">Categoría</label>
        <div className="catopts">
          {CAT_ORDER.map((k) => {
            const c = CATS[k];
            const active = category === k;
            const style = active
              ? {
                  border: `1px solid ${c.color}`,
                  background: `color-mix(in srgb,${c.color} 14%,var(--surface))`,
                  color: c.color,
                }
              : undefined;
            return (
              <button key={k} className="catopt" style={style} onClick={() => setCategory(k)}>
                {c.label}
              </button>
            );
          })}
        </div>

        <label>Título *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />

        <label>Enlace (URL)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />

        <label>Teléfono</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0212-000-0000" />

        <label>Descripción</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />

        <div className="threecol">
          <div>
            <label>Ciudad</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label>País</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>

        <div className="threecol">
          <div>
            <label>Fecha de inicio</label>
            <input
              type="date"
              value={date}
              max={dateEnd || undefined}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label>Fecha de fin (opcional)</label>
            <input
              type="date"
              value={dateEnd}
              min={date || undefined}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
        </div>

        <label>Imagen (opcional)</label>
        <ImageUpload value={image} onChange={setImage} />

        {error && <div className="err">{error}</div>}

        <div className="foot">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-submit" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
