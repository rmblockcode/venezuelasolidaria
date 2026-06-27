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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.venezuelasolidaria.com"
  ),
  title: "Venezuela Solidaria · Directorio de ayuda",
  description:
    "Directorio centralizado de recaudaciones, contactos de emergencia, páginas comunitarias y jornadas solidarias tras los sismos en Venezuela.",
};

export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${hanken.variable} ${newsreader.variable}`}>
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
