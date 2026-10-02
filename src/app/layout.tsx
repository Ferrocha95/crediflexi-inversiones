import type { Metadata, Viewport } from "next";
import { nunito } from "./fuentes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crediflexi Inversiones",
  description: "Herramienta interna de captación e inversiones de Crediflexi",
};

export const viewport: Viewport = {
  themeColor: "#012553",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
