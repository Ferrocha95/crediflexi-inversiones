import "server-only";
import { Image } from "@react-pdf/renderer";
import { COLOR_PDF as COLOR } from "./colores";

// Los dos logos juntos (Crediflexi y Rami Sise) en una sola imagen,
// public/logos-crediflexi-rami-sise.png, para los dos PDF y las dos entidades.
// El nombre del archivo es provisional: se puede reemplazar por otra versión
// sin tocar código, porque la proporción se lee del propio PNG.

export interface LogoPdf {
  readonly datos: Buffer;
  /** Medida en píxeles, del encabezado del PNG (dimensionesPng). */
  readonly ancho: number;
  readonly alto: number;
}

/** El logo a la altura indicada (en puntos), con el ancho que da su proporción. */
export function Logo({ logo, alto }: { logo: LogoPdf; alto: number }) {
  return (
    // El PNG tiene fondo casi blanco (#FCFCFC): siempre va sobre blanco.
    // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML
    <Image src={{ data: logo.datos, format: "png" }} style={{ height: alto, width: (alto * logo.ancho) / logo.alto, backgroundColor: COLOR.blanco }} />
  );
}
