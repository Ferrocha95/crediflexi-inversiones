import type { Esquema, Moneda } from "../../../domain/tasas/semilla.esquema";

// Campos de la calculadora tal como se escriben y su forma para el servidor
// (vista previa, huella de la confirmación y PDF). Puro: corre en el navegador.

/** Plazo especial tal como se escribe en la pantalla. */
export interface EspecialEnPantalla {
  readonly meses: string;
  readonly tasaMensual: string;
  readonly tasaFinal: string;
}

export interface CamposPantalla {
  readonly entidad: string;
  readonly moneda: Moneda;
  readonly esquema: Esquema;
  readonly monto: string;
  readonly plazo: number | null;
  readonly puntosExtra: string;
  readonly especial: EspecialEnPantalla | null;
}

export const SIN_PUNTOS = "0.0";

/**
 * Lo que se manda al servidor. En un plazo especial no va el plazo de tabla y
 * los puntos van en cero (no aplican); unos meses que no son entero van como
 * 0, para que el servidor responda el mensaje en español.
 */
export function camposParaServidor(c: CamposPantalla) {
  const base = { entidad: c.entidad, moneda: c.moneda, esquema: c.esquema, monto: c.monto };
  if (c.especial === null) return { ...base, plazo: c.plazo, puntosExtra: c.puntosExtra, especial: null };
  const meses = c.especial.meses.trim();
  const tasa = (t: string) => (t.trim() === "" ? null : t.trim());
  return {
    ...base,
    plazo: null,
    puntosExtra: SIN_PUNTOS,
    especial: {
      plazo: /^[0-9]+$/.test(meses) ? Number(meses) : 0,
      tasaMensual: tasa(c.especial.tasaMensual),
      tasaFinal: tasa(c.especial.tasaFinal),
    },
  };
}
