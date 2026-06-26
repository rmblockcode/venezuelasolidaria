"use client";

import { useState, useRef } from "react";
import { Resource } from "../lib/types";
import { CATS } from "../lib/constants";
import { formatEventRange } from "../lib/format";

export default function Card({ item }: { item: Resource }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      <p className="desc">{item.desc}</p>
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
    </div>
  );
}
