import type { Metadata } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Venezuela Solidaria · Directorio de ayuda",
  description:
    "Directorio centralizado de recaudaciones, contactos de emergencia, páginas comunitarias y jornadas solidarias tras los sismos en Venezuela.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${hanken.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
