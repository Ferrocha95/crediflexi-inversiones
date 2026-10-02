/**
 * Colores del sistema de diseño. Son los mismos de src/app/globals.css (una
 * prueba lo revisa); aquí existen para probar el contraste. Los de la marca
 * salen del logo y los de estatus y encabezados, del Excel del pipeline
 * (docs/FORMATOS_EXCEL.md).
 */
export const COLOR = {
  marino: "#012553",
  marinoLogo: "#002050",
  marinoAlto: "#0E396D",
  hielo: "#DAE9F8",
  hieloTenue: "#9DB6D6",
  blanco: "#FFFFFF",
  /** Verde de marca: solo cifras grandes (24 px, o 18.66 px en negrita). */
  verde: "#00A010",
  /** Verde para cifras positivas pequeñas: #00A010 no alcanza 4.5:1 sobre marino. */
  verdeTexto: "#3CCB4C",
  /** Amarillo y rojo de marca: solo detalles (la flecha del logo), nunca texto en rojo. */
  amarillo: "#F8C818",
  rojo: "#F80000",
  naranja: "#FC6A0C",
  /** Texto de error legible sobre marino. */
  errorTexto: "#FF9A8F",
  estatusInteresado: "#A8D08D",
  estatusIntermitente: "#FFD965",
  estatusNoInteresado: "#F4B083",
} as const;

/** Tinte y opacidad del vidrio (la misma receta que .vidrio y .barra-vidrio en globals.css). */
export const VIDRIO = {
  tinte: COLOR.marinoAlto,
  opacidad: 0.55,
  tinteBarra: COLOR.marinoLogo,
  opacidadBarra: 0.85,
} as const;
