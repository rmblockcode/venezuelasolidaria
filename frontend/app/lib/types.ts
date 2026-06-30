export type CategoryKey = "donaciones" | "paginas" | "emergencia" | "quedadas";

export interface Resource {
  id: string;
  category: CategoryKey;
  title: string;
  desc: string;
  url?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  date?: string | null;
  dateEnd?: string | null;
  image?: string | null;
  lat?: number | null;
  lng?: number | null;
  verified: boolean;
  status?: string;
}

export interface GalleryPhoto {
  id: number;
  image: string;
  caption?: string | null;
}

// ---- Red Humanitaria de Datos (índice común externo, solo lectura) ----
export type RecordType =
  | "persona_desaparecida"
  | "persona_localizada"
  | "persona_hospitalizada"
  | "centro_acopio"
  | "centro_donacion"
  | "recurso"
  | "otro";

export interface NetworkRecord {
  id: string;
  record_type: RecordType;
  title: string;
  summary?: string | null;
  person_name?: string | null;
  cedula_masked?: string | null;
  age?: number | null;
  organization?: string | null;
  location_name?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  contact?: string | null;
  status?: string | null;
  verified?: boolean | null;
  image_url?: string | null;
  tags?: string[];
  updated_at?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  source_id?: string | null;
  entity_id?: string | null;
}

export interface NetworkSearchResult {
  items: NetworkRecord[];
  total_matches: number;
  source_count?: number | null;
  record_types?: string[];
  pagination: { limit: number; offset: number; returned: number; has_more: boolean };
}

export interface NetworkSource {
  id: string;
  name: string;
  kind?: string | null;
  url?: string | null;
  record_count?: number | null;
  last_sync?: string | null;
}

export interface SubmissionForm {
  category: CategoryKey;
  title: string;
  url: string;
  desc: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  date: string;
  dateEnd: string;
  image: string;
  contact: string;
}
