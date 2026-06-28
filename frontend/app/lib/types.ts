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
