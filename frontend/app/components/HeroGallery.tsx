"use client";

import { useEffect, useRef, useState } from "react";
import { GalleryPhoto } from "../lib/types";
import { fetchGallery } from "../lib/api";

/**
 * Wraps the hero text. When there are gallery photos, they auto-advance as a
 * faint background banner behind the text (subtle, swipeable). With no photos,
 * it renders the text exactly as before.
 */
export default function HeroGallery({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

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

  if (n === 0) {
    return (
      <div className="hero-head">
        <div className="hero-head-content">{children}</div>
      </div>
    );
  }

  const go = (i: number) => setIdx(((i % n) + n) % n);

  return (
    <div
      className="hero-head with-bg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current != null) {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? idx + 1 : idx - 1);
        }
        touchX.current = null;
      }}
    >
      <div className="hg-bg" aria-hidden="true">
        <div className="hg-track" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {photos.map((p) => (
            <div className="hg-slide" key={p.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" />
            </div>
          ))}
        </div>
      </div>
      <div className="hero-head-content">{children}</div>
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
