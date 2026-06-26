"use client";

import { useEffect, useState } from "react";
import { CategoryKey, SubmissionForm } from "../lib/types";
import { CATS, CAT_ORDER } from "../lib/constants";
import { submitResource } from "../lib/api";
import ImageUpload from "./ImageUpload";

const EMPTY: SubmissionForm = {
  category: "donaciones",
  title: "",
  url: "",
  desc: "",
  city: "",
  country: "",
  date: "",
  dateEnd: "",
  image: "",
  contact: "",
};

export default function AddModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState<SubmissionForm>(EMPTY);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update<K extends keyof SubmissionForm>(key: K, value: SubmissionForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
  }

  async function submit() {
    if (!form.title.trim()) return setError("Agrega un nombre o título para el enlace.");
    if (!form.url.trim()) return setError("Agrega el enlace (URL) o un teléfono de contacto.");
    if (form.date && form.dateEnd && form.dateEnd < form.date)
      return setError("La fecha de fin no puede ser anterior a la de inicio.");
    setSending(true);
    const res = await submitResource(form);
    setSending(false);
    if (!res.ok) return setError(res.error || "No se pudo enviar.");
    setSubmitted(true);
    onSubmitted();
  }

  function resetForm() {
    setForm((f) => ({ ...EMPTY, category: f.category }));
    setSubmitted(false);
    setError("");
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        {!submitted ? (
          <div>
            <div className="head">
              <div style={{ flex: 1 }}>
                <h2>Agregar al directorio</h2>
                <p>
                  Tu envío se revisa antes de publicarse. No incluyas datos personales sensibles de
                  terceros.
                </p>
              </div>
              <button className="x" onClick={onClose} aria-label="Cerrar">
                ×
              </button>
            </div>

            <label className="cat">Categoría</label>
            <div className="catopts">
              {CAT_ORDER.map((k: CategoryKey) => {
                const c = CATS[k];
                const active = form.category === k;
                const style = active
                  ? {
                      border: `1px solid ${c.color}`,
                      background: `color-mix(in srgb,${c.color} 14%,var(--surface))`,
                      color: c.color,
                    }
                  : undefined;
                return (
                  <button
                    key={k}
                    className="catopt"
                    style={style}
                    onClick={() => update("category", k)}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <label>Nombre o título del enlace *</label>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ej: Recaudación familias de Cumaná"
            />

            <label>Enlace (URL) o teléfono de contacto *</label>
            <input
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://…  ó  0212-000-0000"
            />

            <label>Descripción</label>
            <textarea
              value={form.desc}
              onChange={(e) => update("desc", e.target.value)}
              placeholder="¿Para qué es y a quién ayuda? Breve y claro."
              rows={2}
            />

            <div className="threecol">
              <div>
                <label>Ciudad (opcional)</label>
                <input
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Caracas, Miami…"
                />
              </div>
              <div>
                <label>País (acopios)</label>
                <input
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="Venezuela, España…"
                />
              </div>
            </div>

            <div className="threecol">
              <div>
                <label>Fecha de inicio (jornadas)</label>
                <input
                  type="date"
                  value={form.date}
                  max={form.dateEnd || undefined}
                  onChange={(e) => update("date", e.target.value)}
                />
              </div>
              <div>
                <label>Fecha de fin (opcional)</label>
                <input
                  type="date"
                  value={form.dateEnd}
                  min={form.date || undefined}
                  onChange={(e) => update("dateEnd", e.target.value)}
                />
              </div>
            </div>

            <label>Imagen (opcional)</label>
            <ImageUpload value={form.image} onChange={(url) => update("image", url)} />

            <label>Tu correo o contacto (opcional, para verificar)</label>
            <input
              value={form.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="Para que podamos confirmar contigo"
            />

            {error && <div className="err">{error}</div>}

            <div className="foot">
              <button className="btn-cancel" onClick={onClose}>
                Cancelar
              </button>
              <button className="btn-submit" onClick={submit} disabled={sending}>
                {sending ? "Enviando…" : "Enviar para revisión"}
              </button>
            </div>
          </div>
        ) : (
          <div className="done">
            <div className="check">✓</div>
            <h2>¡Recibido! Gracias por ayudar</h2>
            <p>
              Tu enlace quedó guardado y será revisado por el equipo antes de publicarse en el
              directorio.
            </p>
            <div className="btns">
              <button className="secondary" onClick={resetForm}>
                Agregar otro
              </button>
              <button className="primary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
