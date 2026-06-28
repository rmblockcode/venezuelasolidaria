"use client";

import { useEffect, useRef, useState } from "react";
import { GalleryPhoto } from "../lib/types";
import { fetchGallery } from "../lib/api";
import { cloudinaryFill } from "../lib/cloudinary";

/**
 * Banda del hero a pantalla completa. Las fotos de la galería se ven como un
 * fondo difuminado por los lados (y por abajo) detrás del texto, y avanzan solas.
 * En móvil se puede deslizar con el dedo (swipe) sobre toda la banda. Sin fotos,
 * el hero se muestra sobre el papel, sin banda.
 */
export default function HeroGallery({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  useEffect(() => {
    fetchGallery().then(setPhotos).catch(() => {});
  }, []);

  const n = photos.length;

  useEffect(() => {
    if (n <= 1 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, paused]);

  useEffect(() => {
    if (n > 0 && idx >= n) setIdx(0);
  }, [n, idx]);

  const go = (i: number) => setIdx(((i % n) + n) % n);

  if (n === 0) {
    return (
      <div className="hero-banner">
        <div className="wrap hero-banner-inner">
          <div className="hero-head-content">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="hero-banner with-bg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        touchY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchX.current != null && touchY.current != null) {
          const dx = e.changedTouches[0].clientX - touchX.current;
          const dy = e.changedTouches[0].clientY - touchY.current;
          // Sólo cuenta como swipe si el gesto es claramente horizontal,
          // así no interfiere con el scroll vertical de la página.
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            go(dx < 0 ? idx + 1 : idx - 1);
          }
        }
        touchX.current = null;
        touchY.current = null;
      }}
    >
      <div className="hg-bg" aria-hidden="true">
        <div className="hg-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {photos.map((p) => (
            <div className="hg-slide" key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cloudinaryFill(p.image, 1600, 600)} alt="" />
            </div>
          ))}
        </div>
        <div className="hg-scrim" />
      </div>
      <div className="wrap hero-banner-inner">
        <div className="hero-head-content">{children}</div>
      </div>
      {n > 1 && (
        <div className="hg-dots">
          {photos.map((_, i) => (
            <button
              key={i}
              className={i === idx ? "active" : ""}
              onClick={() => go(i)}
              aria-label={`Foto ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
