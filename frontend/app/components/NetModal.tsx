"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NetworkRecord } from "../lib/types";
import { REC_TYPES } from "../lib/constants";
import { cloudinaryFill } from "../lib/cloudinary";
import RecIcon from "./RecIcon";

/** Modal de detalle de un registro de la red: imagen completa (sin recorte) y
 *  toda la info sin truncar, con enlace a la fuente original. */
export default function NetModal({
  record,
  onClose,
}: {
  record: NetworkRecord;
  onClose: () => void;
}) {
  const t = REC_TYPES[record.record_type] || REC_TYPES.otro;
  const [zoom, setZoom] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showImage = !!record.image_url && !imgError;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") (zoom ? setZoom(false) : onClose());
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom, onClose]);

  const place = [record.location_name, record.city, record.state, record.country]
    .filter(Boolean)
    .join(", ");
  const mapsQuery =
    record.lat != null && record.lng != null ? `${record.lat},${record.lng}` : record.city || place;
  const mapsUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : "";
  const status =
    record.status && record.status.toLowerCase() !== t.label.toLowerCase() ? record.status : "";

  return createPortal(
    <div
      className="overlay post-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal post-modal" style={{ ["--cat" as string]: t.color }}>
        <button className="x post-x" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryFill(record.image_url, 1000, 700)}
            alt={record.title}
            className="post-cover"
            onClick={() => setZoom(true)}
            onError={() => setImgError(true)}
            title="Ampliar imagen"
          />
        ) : (
          <div className="netmodal-ph" aria-hidden>
            <RecIcon k={record.record_type} size={70} />
          </div>
        )}

        <div className="post-body">
          <div className="post-top">
            <span className="tag">{t.label}</span>
            {record.verified === true && <span className="verified">✓ Verificado</span>}
            {status && <span className="net-status-pill">{status}</span>}
          </div>

          <h2 className="post-title">{record.title}</h2>

          {(place || typeof record.age === "number" || record.cedula_masked) && (
            <p className="post-meta">
              {place &&
                (mapsUrl ? (
                  <a
                    className="post-loc"
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ver en el mapa"
                  >
                    <span className="pin" />
                    {place}
                  </a>
                ) : (
                  <span className="post-loc">
                    <span className="pin" />
                    {place}
                  </span>
                ))}
              {typeof record.age === "number" && <span>{record.age} años</span>}
              {record.cedula_masked && <span>C.I. {record.cedula_masked}</span>}
            </p>
          )}

          {record.summary && <p className="post-desc">{record.summary}</p>}

          <div className="post-actions">
            {record.source_url && (
              <a className="primary" href={record.source_url} target="_blank" rel="noopener noreferrer">
                Ver en la fuente ↗
              </a>
            )}
            {record.source_name && <span className="net-modal-src">Fuente: {record.source_name}</span>}
            <button className="ghost-link" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {zoom && showImage && (
        <div className="lightbox" onClick={() => setZoom(false)}>
          <button className="lightbox-close" aria-label="Cerrar" onClick={() => setZoom(false)}>
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={record.image_url || ""} alt={record.title} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>,
    document.body
  );
}
