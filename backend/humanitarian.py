"""Proxy de lectura a la Red Humanitaria de Datos (índice común de Venezuela).

La red (https://redayuda.eriktaveras.com) agrega muchas fuentes; su API de lectura
es pública pero NO envía cabeceras CORS, así que el navegador no puede llamarla
directo. Este módulo la consulta desde el servidor, cachea brevemente y normaliza
cada registro a un esquema limpio (omitiendo la cédula completa).
"""

import json
import os
import re
import time
import unicodedata
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


_PAGE = 50  # límite máx por página en la API de redayuda
_WORD = re.compile(r"[a-z0-9]+")


def _fold(s):
    """minúsculas + sin acentos, para puntuar sin que acentos/mayúsculas estorben."""
    s = unicodedata.normalize("NFKD", str(s or ""))
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def _toks(s):
    return _WORD.findall(_fold(s))


def _raw_search(q, record_type="", city="", source_id="", limit=_PAGE, offset=0):
    data = _get(
        "/api/records/search",
        {"q": q, "record_type": record_type, "city": city, "source_id": source_id,
         "limit": limit, "offset": offset},
    )
    return data if isinstance(data, dict) else None


def _score_rec(rec, qtokens, qjoin, base):
    """Cercanía del registro a la búsqueda. Prioriza coincidencia exacta y que estén
    TODAS las palabras; el apellido suelto puntúa poco."""
    blob = _fold(" ".join(str(rec.get(k) or "") for k in ("person_name", "title", "organization")))
    btoks = _WORD.findall(blob)
    bset = set(btoks)
    bjoin = " ".join(btoks)
    matched = sum(1 for t in qtokens if t in bset)      # palabras como token completo
    sub = sum(1 for t in qtokens if t in blob)          # palabras como subcadena
    s = 0.0
    if qtokens and bjoin == qjoin:
        s += 100000                                     # nombre == búsqueda
    if qtokens and matched == len(qtokens):
        s += 50000                                      # están TODAS las palabras
    s += 5000 * matched + 500 * sub + 0.1 * (base or 0)
    return s


def search(q="", record_type="", city="", source_id="", limit=24, offset=0):
    """Busca en la red. Para nombres (2+ palabras) reúne candidatos y los re-ordena
    por cercanía (las coincidencias más exactas primero). Devuelve None si falla."""
    q = (q or "").strip()
    qtokens = _toks(q)

    # 1 palabra / sin query / filtros: confiamos en el orden de redayuda (ya va bien).
    if len(qtokens) < 2:
        data = _raw_search(q, record_type, city, source_id, limit=limit, offset=offset)
        if data is None:
            return None
        items = [n for n in (normalize(r.get("record")) for r in (data.get("results") or [])) if n]
        return {"items": items, "total_matches": data.get("total_matches", len(items)),
                "source_count": data.get("source_count"), "record_types": data.get("record_types") or []}

    # Multi-palabra (nombres): construir un pool de candidatos y re-rankear.
    pool = {}            # id -> (record, score_redayuda)
    meta = {"source_count": None, "record_types": []}

    def ingest(data):
        if not isinstance(data, dict):
            return
        meta["source_count"] = data.get("source_count") or meta["source_count"]
        if data.get("record_types"):
            meta["record_types"] = data["record_types"]
        for r in data.get("results") or []:
            rec = r.get("record") or {}
            rid = rec.get("id")
            if rid and rid not in pool:
                pool[rid] = (rec, r.get("score") or 0)

    # query completa (orden de redayuda), 2 páginas
    for off in (0, _PAGE):
        ingest(_raw_search(q, record_type, city, source_id, limit=_PAGE, offset=off))

    # palabra más distintiva (menor total) — rescata al que redayuda enterró
    uniq = list(dict.fromkeys(qtokens))
    counts = []
    for t in uniq:
        d = _raw_search(t, record_type, city, source_id, limit=1, offset=0)
        if d:
            counts.append((t, d.get("total_matches", 0)))
    if counts:
        rare = min(counts, key=lambda c: c[1])[0]
        ingest(_raw_search(rare, record_type, city, source_id, limit=_PAGE, offset=0))

    qjoin = " ".join(qtokens)
    ranked = sorted(
        pool.values(), key=lambda rv: (_score_rec(rv[0], qtokens, qjoin, rv[1]), rv[1]), reverse=True
    )
    window = ranked[offset:offset + limit]
    items = [n for n in (normalize(rec) for rec, _ in window) if n]
    # total = tamaño del pool re-rankeado (lo relevante); así "cargar más" no cicla.
    return {"items": items, "total_matches": len(pool),
            "source_count": meta["source_count"], "record_types": meta["record_types"]}


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
