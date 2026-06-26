export interface PlaceSuggestion {
  label: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

// Photon returns local country names; normalize the common ones to Spanish so
// the country filter stays consistent.
const ES_COUNTRY: Record<string, string> = {
  "United States": "Estados Unidos",
  "United States of America": "Estados Unidos",
  "United Kingdom": "Reino Unido",
  Brazil: "Brasil",
  Germany: "Alemania",
  Italy: "Italia",
  France: "Francia",
  Canada: "Canadá",
};

function esCountry(name: string): string {
  return ES_COUNTRY[name] || name;
}

/**
 * Place autocomplete via Photon (komoot) — free, no API key, OSM-based.
 * Returns suggestions with exact coordinates, so no separate geocoding is needed.
 */
export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Photon only supports lang: default|de|en|fr. "default" returns local names.
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=default&limit=6`;
  let data: { features?: PhotonFeature[] };
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const f of data.features || []) {
    const p = f.properties || {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const name = p.name || p.city || "";
    if (!name) continue;
    const country = esCountry(p.country || "");
    const label = [name, p.state, country]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, city: p.city || p.name || "", country, lat: coords[1], lng: coords[0] });
  }
  return out;
}

interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}
