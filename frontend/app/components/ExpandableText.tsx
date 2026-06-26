"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Clamps text to `lines` and shows a "Ver más / Ver menos" toggle, but only when
 * the text actually overflows. Works the same on mobile and desktop (inline, no modal).
 */
export default function ExpandableText({
  text,
  lines = 3,
  className = "",
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, lines, expanded]);

  return (
    <div className="exp-wrap">
      <p
        ref={ref}
        className={`${className} exp-text${expanded ? "" : " clamped"}`}
        style={{ ["--lines"]: lines } as React.CSSProperties}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <button type="button" className="exp-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}
