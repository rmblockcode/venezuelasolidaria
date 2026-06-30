import { RecordType } from "../lib/types";

/** Iconos de línea por tipo de registro de la red — usados como portada generada
 *  cuando un registro no trae foto. */
export default function RecIcon({
  k,
  size = 44,
  className,
}: {
  k: RecordType;
  size?: number;
  className?: string;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (k) {
    case "persona_desaparecida":
      // persona dentro de una lupa: "buscando a alguien"
      return (
        <svg {...p}>
          <circle cx="10.5" cy="10.5" r="7.5" />
          <line x1="16.5" y1="16.5" x2="21.5" y2="21.5" />
          <circle cx="10.5" cy="8.7" r="2" />
          <path d="M6.8 14.6a3.8 3.8 0 0 1 7.4 0" />
        </svg>
      );
    case "persona_localizada":
      // persona con check
      return (
        <svg {...p}>
          <circle cx="10" cy="8" r="3.4" />
          <path d="M4.2 20a5.8 5.8 0 0 1 11.6 0" />
          <polyline points="15.5 12.5 18 15 22 10.5" />
        </svg>
      );
    case "persona_hospitalizada":
      // cruz médica
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "centro_acopio":
      // caja / paquete
      return (
        <svg {...p}>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22" x2="12" y2="12" />
        </svg>
      );
    case "centro_donacion":
      // corazón
      return (
        <svg {...p}>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      );
    case "recurso":
      // información
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9.5" />
          <line x1="12" y1="11" x2="12" y2="16.5" />
          <circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      // otro
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
  }
}
