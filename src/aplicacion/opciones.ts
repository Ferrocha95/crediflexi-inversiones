import { PLAZO_ESPECIAL } from "../domain/interes/ajustes";
import { limitesFechaInicio, type RangoFechaInicio } from "../domain/interes/diasNaturales";
import { ESQUEMAS, MONEDAS, type Esquema, type Moneda, type Semilla } from "../domain/tasas/semilla.esquema";
import { OPCIONES_PUNTOS } from "./ajustes";
import { TOPES } from "./modelo";
import { rellenar } from "./rellenar";
import type { TextosCotizacion } from "./textos";

/** Una moneda del formulario. */
export interface OpcionMoneda {
  readonly moneda: Moneda;
  /** false si su tabla está POR_CONFIRMAR (va deshabilitada con su motivo). */
  readonly habilitada: boolean;
  readonly motivo: string | null;
  /** Entidades a las que aplica su tabla (aplica_a_entidades de la semilla); null = a todas. */
  readonly entidades: readonly string[] | null;
}

/** Opciones del formulario del cotizador. Solo texto: es lo que recibe el navegador. */
export interface OpcionesCotizador {
  readonly entidades: readonly { readonly clave: string; readonly razonSocial: string }[];
  /** Solo las monedas con tabla en la semilla; las POR_CONFIRMAR van deshabilitadas con su motivo. */
  readonly monedas: readonly OpcionMoneda[];
  readonly esquemas: readonly { readonly esquema: Esquema; readonly nombre: string }[];
  /** Topes en caracteres de los campos opcionales del PDF (los de modelo.ts). */
  readonly topes: Readonly<Record<keyof typeof TOPES, number>>;
  /** Valores del selector de puntos extra ("0.0" a "5.0"). */
  readonly puntosExtra: readonly string[];
  /** Meses permitidos en un plazo especial. */
  readonly plazoEspecial: { readonly minimo: number; readonly maximo: number };
  /** Fecha de inicio: hoy en la Ciudad de México (por omisión) y el rango permitido, en AAAA-MM-DD. */
  readonly fechaInicio: { readonly hoy: string; readonly minimo: string; readonly maximo: string };
}

export interface ParametrosOpciones {
  readonly semilla: Semilla;
  readonly razonesSociales: ReadonlyMap<string, string>;
  readonly textos: TextosCotizacion;
  readonly rangoFechaInicio: RangoFechaInicio;
}

/** `hoy` es la fecha de hoy en la Ciudad de México (AAAA-MM-DD); entra como parámetro para que la función sea pura. */
export function opcionesCotizador({ semilla, razonesSociales, textos, rangoFechaInicio }: ParametrosOpciones, hoy: string): OpcionesCotizador {
  return {
    // Las claves y las razones sociales salen del mismo arreglo entidades[] de la semilla.
    entidades: semilla.entidades.map((clave) => ({ clave, razonSocial: razonesSociales.get(clave) ?? clave })),
    monedas: MONEDAS.flatMap((moneda) => {
      const tabla = semilla.tablas[moneda];
      if (tabla === undefined) return [];
      const habilitada = tabla.estatus !== "POR_CONFIRMAR";
      return [
        {
          moneda,
          habilitada,
          motivo: habilitada ? null : rellenar(textos.monedaDeshabilitada, { moneda }),
          entidades: tabla.aplicaAEntidades === null ? null : [...tabla.aplicaAEntidades],
        },
      ];
    }),
    esquemas: ESQUEMAS.map((esquema) => ({ esquema, nombre: textos.nombreEsquema[esquema] })),
    topes: { ...TOPES },
    puntosExtra: [...OPCIONES_PUNTOS],
    plazoEspecial: { ...PLAZO_ESPECIAL },
    fechaInicio: { hoy, ...limitesFechaInicio(hoy, rangoFechaInicio) },
  };
}
