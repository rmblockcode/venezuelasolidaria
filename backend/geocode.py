"""City/country -> (lat, lng) via OpenStreetMap Nominatim.

Free, no API key. Nominatim's usage policy asks for a descriptive User-Agent and
no more than ~1 request/second, so results are cached in memory by query.
"""

import json
import urllib.parse
import urllib.request

_NOMINATIM = "https://nominatim.openstreetmap.org/search"
_UA = "VenezuelaSolidaria/1.0 (directorio comunitario de ayuda)"

_cache: dict[str, tuple[float, float] | None] = {}

# Words that mean "everywhere", not an actual place — don't geocode them as a city.
_GENERIC = {"nacional", "nationwide", "internacional", "online", "en línea", "remoto", "varios"}


def geocode(city, country, timeout=5):
    """Return (lat, lng) for the place, or None if it can't be resolved."""
    city = (city or "").strip()
    country = (country or "").strip()
    if city.lower() in _GENERIC:
        city = ""  # generic term: fall back to country (or nothing)
    parts = [p for p in [city, country] if p]
    if not parts:
        return None
    query = ", ".join(parts)
    key = query.lower()
    if key in _cache:
        return _cache[key]

    url = _NOMINATIM + "?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1}
    )
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
    except Exception:
        return None  # transient failure — don't cache, allow a later retry

    result = None
    if data:
        try:
            result = (float(data[0]["lat"]), float(data[0]["lon"]))
        except (KeyError, ValueError, IndexError):
            result = None
    _cache[key] = result
    return result
