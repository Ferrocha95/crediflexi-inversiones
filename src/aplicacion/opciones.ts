import { ESQUEMAS, MONEDAS, type Esquema, type Moneda, type Semilla } from "../domain/tasas/semilla.esquema";
import { TOPES } from "./modelo";
import { rellenar } from "./rellenar";
import type { TextosCotizacion } from "./textos";

/** Opciones del formulario del cotizador. Solo texto: es lo que recibe el navegador. */
export interface OpcionesCotizador {
  readonly entidades: readonly { readonly clave: string; readonly razonSocial: string }[];
  /** Solo las monedas con tabla en la semilla; las POR_CONFIRMAR van deshabilitadas con su motivo. */
  readonly monedas: readonly { readonly moneda: Moneda; readonly habilitada: boolean; readonly motivo: string | null }[];
  readonly esquemas: readonly { readonly esquema: Esquema; readonly nombre: string }[];
  /** Topes en caracteres de los campos opcionales del PDF (los de modelo.ts). */
  readonly topes: Readonly<Record<keyof typeof TOPES, number>>;
}

export interface ParametrosOpciones {
  readonly semilla: Semilla;
  readonly razonesSociales: ReadonlyMap<string, string>;
  readonly textos: TextosCotizacion;
}

export function opcionesCotizador({ semilla, razonesSociales, textos }: ParametrosOpciones): OpcionesCotizador {
  return {
    // Las claves y las razones sociales salen del mismo arreglo entidades[] de la semilla.
    entidades: semilla.entidades.map((clave) => ({ clave, razonSocial: razonesSociales.get(clave) ?? clave })),
    monedas: MONEDAS.flatMap((moneda) => {
      const tabla = semilla.tablas[moneda];
      if (tabla === undefined) return [];
      const habilitada = tabla.estatus !== "POR_CONFIRMAR";
      return [{ moneda, habilitada, motivo: habilitada ? null : rellenar(textos.monedaDeshabilitada, { moneda }) }];
    }),
    esquemas: ESQUEMAS.map((esquema) => ({ esquema, nombre: textos.nombreEsquema[esquema] })),
    topes: { ...TOPES },
  };
}
