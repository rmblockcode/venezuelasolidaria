"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Resource } from "../lib/types";
import { CATS } from "../lib/constants";
import { formatEventRange } from "../lib/format";

export default function ListItem({ item }: { item: Resource }) {
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const c = CATS[item.category];
  const isPhone = item.category === "emergencia";
  const copyValue = item.phone || item.url || "";
  const meta = [item.city, item.country, formatEventRange(item.date, item.dateEnd)]
    .filter(Boolean)
    .join("  ·  ");
  const href = isPhone && item.phone ? `tel:${item.phone}` : item.url || "#";

  useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);

  function onCopy() {
    try {
      navigator.clipboard.writeText(copyValue);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="dir-row" style={{ "--cat": c.color } as React.CSSProperties}>
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="dir-thumb"
          loading="lazy"
          onClick={() => setZoom(true)}
          title="Ampliar imagen"
        />
      )}
      <div className="dir-row-main">
        <div className="dir-row-top">
          <span className="tag">{c.label}</span>
          {item.verified ? (
            <span className="verified">✓ Verificado</span>
          ) : (
            <span className="unverified">Sin verificar</span>
          )}
          {meta && <span className="dir-meta">{meta}</span>}
        </div>
        <h3>{item.title}</h3>
        {item.desc && <p className="dir-desc">{item.desc}</p>}
      </div>
      <div className="dir-row-actions">
        {(item.url || item.phone) && (
          <a className="primary" href={href} target="_blank" rel="noopener noreferrer">
            {c.action}
          </a>
        )}
        {copyValue && (
          <button className="copy" onClick={onCopy}>
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
        )}
      </div>

      {zoom &&
        item.image &&
        createPortal(
          <div className="lightbox" onClick={() => setZoom(false)}>
            <button className="lightbox-close" aria-label="Cerrar" onClick={() => setZoom(false)}>
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt={item.title} onClick={(e) => e.stopPropagation()} />
          </div>,
          document.body
        )}
    </div>
  );
}
