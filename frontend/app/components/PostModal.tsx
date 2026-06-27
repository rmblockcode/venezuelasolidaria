"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Resource } from "../lib/types";
import { CATS } from "../lib/constants";
import { formatEventRange } from "../lib/format";
import { shareResource } from "../lib/share";

export default function PostModal({ resource }: { resource: Resource | null }) {
  const router = useRouter();
  const [zoom, setZoom] = useState(false);
  const [shared, setShared] = useState(false);

  function close() {
    // Go back if there's history, otherwise to the home.
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") (zoom ? setZoom(false) : close());
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  if (!resource) {
    return (
      <div className="overlay" onClick={() => router.push("/")}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="done">
            <h2>Publicación no disponible</h2>
            <p>Este recurso no existe o aún no está publicado.</p>
            <div className="btns">
              <button className="primary" onClick={() => router.push("/")}>
                Ir al directorio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const item = resource;
  const c = CATS[item.category];
  const isPhone = !item.url && !!item.phone;
  const href = isPhone ? `tel:${item.phone}` : item.url || "#";
  const actionLabel = isPhone ? "Llamar" : c.action;
  const meta = [item.city, item.country, formatEventRange(item.date, item.dateEnd)]
    .filter(Boolean)
    .join("  ·  ");

  async function onShare() {
    const copied = await shareResource(item.id, item.title);
    if (copied) {
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    }
  }

  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal post-modal" style={{ ["--cat" as string]: c.color }}>
        <button className="x post-x" onClick={close} aria-label="Cerrar">
          ×
        </button>

        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.title}
            className="post-cover"
            onClick={() => setZoom(true)}
            title="Ampliar imagen"
          />
        )}

        <div className="post-top">
          <span className="tag">{c.label}</span>
          {item.verified ? (
            <span className="verified">✓ Verificado</span>
          ) : (
            <span className="unverified">Sin verificar</span>
          )}
        </div>

        <h2 className="post-title">{item.title}</h2>
        {meta && <p className="post-meta">{meta}</p>}
        {item.desc && <p className="post-desc">{item.desc}</p>}

        <div className="post-actions">
          {(item.url || item.phone) && (
            <a
              className="primary"
              href={href}
              target={isPhone ? undefined : "_blank"}
              rel="noopener noreferrer"
            >
              {actionLabel}
            </a>
          )}
          <button className="share" onClick={onShare}>
            {shared ? "Enlace copiado ✓" : "↗ Compartir"}
          </button>
          <button className="ghost-link" onClick={close}>
            Volver al directorio
          </button>
        </div>
      </div>

      {zoom && item.image && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <button className="lightbox-close" aria-label="Cerrar" onClick={() => setZoom(false)}>
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
