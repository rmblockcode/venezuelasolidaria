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

# Normalize common abbreviations/aliases that Nominatim doesn't resolve.
_COUNTRY_ALIASES = {
    "rep. dominicana": "República Dominicana",
    "rep dominicana": "República Dominicana",
    "republica dominicana": "República Dominicana",
    "rd": "República Dominicana",
    "ee.uu.": "Estados Unidos",
    "ee. uu.": "Estados Unidos",
    "eeuu": "Estados Unidos",
    "usa": "Estados Unidos",
    "us": "Estados Unidos",
    "u.s.a.": "Estados Unidos",
    "estados unidos de américa": "Estados Unidos",
    "uk": "Reino Unido",
    "u.k.": "Reino Unido",
    "reino unido de gran bretaña": "Reino Unido",
    "vzla": "Venezuela",
    "rep. bolivariana de venezuela": "Venezuela",
}


def _normalize_country(country):
    c = (country or "").strip()
    return _COUNTRY_ALIASES.get(c.lower(), c)


def _query_nominatim(query, timeout):
    key = query.lower()
    if key in _cache:
        return _cache[key]
    url = _NOMINATIM + "?" + urllib.parse.urlencode({"q": query, "format": "json", "limit": 1})
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


def geocode(city, country, timeout=5):
    """Return (lat, lng) for the place, or None if it can't be resolved.

    Tries "city, country" first; if that fails, falls back to the country alone
    (so a messy/unknown city still lands a country-level pin). Country aliases
    like "Rep. Dominicana" or "EE.UU." are normalized before querying."""
    city = (city or "").strip()
    if city.lower() in _GENERIC:
        city = ""  # generic term: fall back to country (or nothing)
    country = _normalize_country(country)

    # Try the most specific query first, then progressively broader fallbacks.
    queries = []
    if city and country:
        queries.append(f"{city}, {country}")
    if city and not country:
        queries.append(city)
    if country:
        queries.append(country)  # country-level fallback

    for q in queries:
        result = _query_nominatim(q, timeout)
        if result:
            return result
    return None
