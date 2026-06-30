"""Proxy de lectura a la Red Humanitaria de Datos (índice común de Venezuela).

La red (https://redayuda.eriktaveras.com) agrega muchas fuentes; su API de lectura
es pública pero NO envía cabeceras CORS, así que el navegador no puede llamarla
directo. Este módulo la consulta desde el servidor, cachea brevemente y normaliza
cada registro a un esquema limpio (omitiendo la cédula completa).
"""

import json
import os
import time
import urllib.parse
import urllib.request

# URL del índice común (configurable por entorno; por defecto, la red pública).
BASE = os.environ.get("HUMANITARIAN_API_BASE", "https://redayuda.eriktaveras.com").rstrip("/")
_UA = "VenezuelaSolidaria/1.0 (directorio comunitario de ayuda)"
_TTL = int(os.environ.get("HUMANITARIAN_CACHE_TTL", "90"))  # seg. de caché

# Caché de módulo: { key: (timestamp, payload) }. Sin expiración fina, solo TTL.
_cache: dict[str, tuple[float, object]] = {}

RECORD_TYPES = [
    "persona_desaparecida",
    "persona_localizada",
    "persona_hospitalizada",
    "centro_acopio",
    "centro_donacion",
    "recurso",
    "otro",
]


def _get(path, params=None, timeout=6):
    """GET JSON de la red, con caché TTL. Devuelve el objeto o None si falla."""
    qs = urllib.parse.urlencode({k: v for k, v in (params or {}).items() if v not in (None, "")})
    url = f"{BASE}{path}" + (f"?{qs}" if qs else "")

    cached = _cache.get(url)
    if cached and time.time() - cached[0] < _TTL:
        return cached[1]

    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
    except Exception:
        return None  # fallo transitorio — no se cachea, se permite reintento

    _cache[url] = (time.time(), data)
    return data


def _mask_cedula(value):
    """No exponemos la cédula completa: solo los últimos 4 dígitos."""
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) < 4:
        return None
    return "••••" + digits[-4:]


def _clean_text(value):
    """Descarta texto roto de origen (p.ej. multipart/form-data filtrado)."""
    s = (value or "").strip()
    if not s:
        return None
    if "Content-Disposition" in s or "form-data" in s or "name=\"" in s:
        return None
    return s


def normalize(rec):
    """Registro de la red -> dict limpio y seguro para el frontend."""
    if not isinstance(rec, dict):
        return None
    return {
        "id": rec.get("id"),
        "record_type": rec.get("record_type") or "otro",
        "title": _clean_text(rec.get("title"))
        or rec.get("person_name")
        or rec.get("organization")
        or "Sin título",
        "summary": _clean_text(rec.get("summary")),
        "person_name": rec.get("person_name"),
        "cedula_masked": _mask_cedula(rec.get("cedula")),
        "age": rec.get("age"),
        "organization": rec.get("organization"),
        "location_name": rec.get("location_name"),
        "city": rec.get("city"),
        "state": rec.get("state"),
        "country": rec.get("country"),
        "lat": rec.get("latitude"),
        "lng": rec.get("longitude"),
        "contact": rec.get("contact"),
        "status": rec.get("status"),
        "verified": rec.get("verified"),
        "image_url": rec.get("image_url"),
        "tags": rec.get("tags") or [],
        "updated_at": rec.get("updated_at"),
        # procedencia — siempre visible para el usuario
        "source_name": rec.get("source_name"),
        "source_url": rec.get("source_url"),
        "source_id": rec.get("source_id"),
        "entity_id": rec.get("entity_id"),
    }


def search(q="", record_type="", city="", source_id="", limit=24, offset=0):
    """Busca en la red. Devuelve dict normalizado o None si la red no responde."""
    data = _get(
        "/api/records/search",
        {
            "q": q,
            "record_type": record_type,
            "city": city,
            "source_id": source_id,
            "limit": limit,
            "offset": offset,
        },
    )
    if not isinstance(data, dict):
        return None
    results = data.get("results") or []
    items = [n for n in (normalize(r.get("record")) for r in results) if n]
    return {
        "items": items,
        "total_matches": data.get("total_matches", len(items)),
        "source_count": data.get("source_count"),
        "record_types": data.get("record_types") or [],
    }


def recent(limit=24, since=0):
    """Registros recientes (feed) para la carga inicial."""
    data = _get("/api/records/feed", {"since": since, "limit": limit})
    if not isinstance(data, dict):
        return None
    records = data.get("records") or []
    return {
        "items": [n for n in (normalize(r) for r in records) if n],
        "next_cursor": data.get("next_cursor"),
        "has_more": bool(data.get("has_more")),
    }


def record(rid):
    """Detalle de un registro por id, normalizado. None si no existe/falla."""
    data = _get(f"/api/records/{urllib.parse.quote(rid, safe='')}")
    if not isinstance(data, dict):
        return None
    # La API puede devolver el registro plano o envuelto en {record: {...}}.
    return normalize(data.get("record") if "record" in data else data)


def sources():
    """Lista de fuentes conectadas (para atribución / contador)."""
    data = _get("/api/sources")
    if not isinstance(data, list):
        return None
    return [
        {
            "id": s.get("id"),
            "name": s.get("name"),
            "kind": s.get("kind"),
            "url": s.get("url"),
            "record_count": s.get("record_count"),
            "last_sync": s.get("last_sync"),
        }
        for s in data
        if isinstance(s, dict)
    ]
