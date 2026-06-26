"use client";

import { useEffect, useRef, useState } from "react";
import { PlaceSuggestion, searchPlaces } from "../lib/places";

export default function LocationAutocomplete({
  initial = "",
  onSelect,
  onClear,
}: {
  initial?: string;
  onSelect: (p: PlaceSuggestion) => void;
  onClear?: () => void;
}) {
  const [text, setText] = useState(initial);
  const [list, setList] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search as the user types.
  useEffect(() => {
    if (text.trim().length < 3) {
      setList([]);
      return;
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setLoading(true);
      try {
        const results = await searchPlaces(text, ctrl.current.signal);
        setList(results);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="loc-auto" ref={boxRef}>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (!e.target.value.trim()) onClear?.();
        }}
        onFocus={() => {
          if (list.length) setOpen(true);
        }}
        placeholder="Escribe una ciudad… (ej. Caracas)"
        autoComplete="off"
      />
      {open && (loading || list.length > 0) && (
        <ul className="loc-list">
          {loading && list.length === 0 && <li className="loc-loading">Buscando…</li>}
          {list.map((p, i) => (
            <li
              key={i}
              onClick={() => {
                onSelect(p);
                setText(p.label);
                setOpen(false);
              }}
            >
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
