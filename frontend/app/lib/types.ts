export type CategoryKey = "donaciones" | "paginas" | "emergencia" | "quedadas";
export type ThemeKey = "esperanza" | "sereno" | "tricolor";

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
  verified: boolean;
  status?: string;
}

export interface SubmissionForm {
  category: CategoryKey;
  title: string;
  url: string;
  desc: string;
  city: string;
  country: string;
  date: string;
  dateEnd: string;
  contact: string;
}
