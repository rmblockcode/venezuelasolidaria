"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Resource } from "../lib/types";
import { CATS } from "../lib/constants";
import { formatEventRange } from "../lib/format";
import { resourcePath, shareResource } from "../lib/share";
import ExpandableText from "./ExpandableText";

export default function ListItem({ item }: { item: Resource }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [zoom, setZoom] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const c = CATS[item.category];
  const isPhone = !item.url && !!item.phone;
  const copyValue = item.phone || item.url || "";
  const meta = [item.city, item.country, formatEventRange(item.date, item.dateEnd)]
    .filter(Boolean)
    .join("  ·  ");
  const href = isPhone ? `tel:${item.phone}` : item.url || "#";
  const actionLabel = isPhone ? "Llamar" : c.action;

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

  async function onShare() {
    if (await shareResource(item.id, item.title)) {
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    }
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
        <h3>
          <Link href={resourcePath(item.id)} className="post-title-link">
            {item.title}
          </Link>
        </h3>
        {item.desc && <ExpandableText text={item.desc} lines={2} className="dir-desc" />}
      </div>
      <div className="dir-row-actions">
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
        {copyValue && (
          <button className="copy" onClick={onCopy}>
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
        )}
        <button className="copy" onClick={onShare} title="Compartir enlace">
          {shared ? "Enlace ✓" : "↗ Compartir"}
        </button>
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
