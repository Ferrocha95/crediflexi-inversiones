import type { Metadata, Viewport } from "next";
import { nunito } from "./fuentes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crediflexi Inversiones",
  description: "Herramienta interna de captación e inversiones de Crediflexi",
  // Herramienta interna: que ningún buscador la indexe (también public/robots.txt).
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#012553",
  colorScheme: "dark",
  viewportFit: "cover",
};

/**
 * Raíz: solo html, body y la fuente. El menú y el marco viven en
 * src/app/(app)/layout.tsx, que exige sesión; /acceso no los lleva.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
