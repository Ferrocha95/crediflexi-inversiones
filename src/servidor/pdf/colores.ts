// Colores del PDF. Sin "server-only" para que la prueba de contraste
// (tests/unit/diseno/contraste.test.ts) pueda leerlos.

/** Colores sacados del logo. Amarillo y rojo solo van en la línea decorativa. */
export const COLOR_PDF = {
  marino: "#002050",
  verde: "#00A010",
  amarillo: "#F8C818",
  naranja: "#FC6A0C",
  rojo: "#F80000",
  gris: "#566176",
  linea: "#DCE2EB",
  fondoVerde: "#EAF7EC",
  fondoMarino: "#F0F3F8",
  fondoTenue: "#F8FAFC",
  blanco: "#FFFFFF",
  /**
   * Bandas de las modalidades en la página 2: el verde (#00A010) y el dorado
   * (#F8C818) del Excel de los ejecutivos, oscurecidos sin cambiar el matiz
   * hasta que el texto blanco cumpla 4.5:1 (4.76:1 y 4.63:1).
   */
  bandaVerde: "#00860D",
  bandaDorada: "#8F7104",
  /** Cuadrícula suave de las gráficas. */
  cuadricula: "#E6EBF2",
} as const;
