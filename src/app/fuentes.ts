import localFont from "next/font/local";

/**
 * Nunito (SIL Open Font License 1.1, ver fuentes/LICENCIA-Nunito-OFL.txt), la
 * misma del PDF. Archivos copiados de @fontsource/nunito y empaquetados con la
 * app: nada se descarga de un CDN. El subconjunto latin trae las vocales
 * acentuadas, ñ, ü, ¿ y ¡. Sus dígitos ya tienen todos el mismo ancho.
 */
export const nunito = localFont({
  src: [
    { path: "./fuentes/nunito-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fuentes/nunito-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fuentes/nunito-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fuentes/nunito-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-nunito",
  display: "swap",
  adjustFontFallback: "Arial",
});
