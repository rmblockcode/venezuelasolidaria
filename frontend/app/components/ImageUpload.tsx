"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_IMAGE_MB, uploadImage, validateImageFile } from "../lib/cloudinary";

/**
 * Optional image control. Accepts a file via drag & drop, paste (Ctrl/Cmd+V),
 * or the file picker; validates JPG/PNG and size; uploads to Cloudinary and
 * reports the resulting URL via onChange.
 */
export default function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  // Paste support: only acts when the clipboard actually carries an image,
  // so it never interferes with normal text paste into other fields.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
          }
          return;
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (value) {
    return (
      <div className="img-upload has-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Vista previa" className="img-preview" />
        <div className="img-actions">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            Cambiar
          </button>
          <button type="button" className="danger" onClick={() => onChange("")} disabled={uploading}>
            Quitar
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {error && <div className="img-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="img-upload">
      <div
        className={`img-drop${dragging ? " dragging" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {uploading ? (
          <span>Subiendo imagen…</span>
        ) : (
          <span>
            Arrastra una imagen, pégala (Ctrl/Cmd+V) o <u>elige un archivo</u>
            <small>JPG o PNG · máx. {MAX_IMAGE_MB} MB</small>
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <div className="img-error">{error}</div>}
    </div>
  );
}
