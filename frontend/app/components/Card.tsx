"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Resource } from "../lib/types";
import { CATS } from "../lib/constants";
import { formatEventRange } from "../lib/format";
import ExpandableText from "./ExpandableText";

export default function Card({ item }: { item: Resource }) {
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!zoom) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoom(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);

  const c = CATS[item.category];
  const isPhone = item.category === "emergencia";
  const copyValue = item.phone || item.url || "";
  const meta = [item.city, formatEventRange(item.date, item.dateEnd)]
    .filter(Boolean)
    .join("  ·  ");
  const href = isPhone && item.phone ? `tel:${item.phone}` : item.url || "#";

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
    <div className="card" style={{ "--cat": c.color } as React.CSSProperties}>
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.title}
          className="card-cover"
          loading="lazy"
          onClick={() => setZoom(true)}
          title="Ampliar imagen"
        />
      )}
      <div className="toprow">
        <span className="tag">{c.label}</span>
        <div style={{ flex: 1 }} />
        {item.verified ? (
          <span className="verified">✓ Verificado</span>
        ) : (
          <span className="unverified">Sin verificar</span>
        )}
      </div>
      <h3>{item.title}</h3>
      {item.desc && <ExpandableText text={item.desc} lines={4} className="desc" />}
      {meta && (
        <div className="meta">
          <span className="pin" />
          {meta}
        </div>
      )}
      <div className="actions">
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
