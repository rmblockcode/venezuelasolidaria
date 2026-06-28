"use client";

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";

/** Fila de "slides" horizontal (estilo Booking/Airbnb): encabezado con título,
 *  enlace "Ver todas" y flechas ‹ › que se desactivan en los extremos. */
export default function Carousel({
  title,
  icon,
  count,
  onSeeAll,
  seeAllLabel = "Ver todas",
  children,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  function nudge(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  }

  return (
    <section className="carousel">
      <div className="carousel-head">
        <h2>
          {icon && <span className="carousel-ic">{icon}</span>}
          {title}
          {typeof count === "number" && <span className="carousel-count">{count}</span>}
        </h2>
        <div className="carousel-nav">
          {onSeeAll && (
            <button type="button" className="carousel-all" onClick={onSeeAll}>
              {seeAllLabel} →
            </button>
          )}
          <button
            type="button"
            className="carousel-arrow"
            onClick={() => nudge(-1)}
            disabled={atStart}
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-arrow"
            onClick={() => nudge(1)}
            disabled={atEnd}
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>
      </div>
      <div className="carousel-track" ref={track} onScroll={update}>
        {children}
      </div>
    </section>
  );
}
