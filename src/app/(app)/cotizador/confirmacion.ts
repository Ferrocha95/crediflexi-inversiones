import { TEXTOS } from "./textosPantalla";

// Lógica pura de la confirmación: no importa nada de src/domain, de Next ni de
// React, para probarla completa sin navegador.

/** Los campos del formulario tal como se escribieron (el monto sin normalizar). */
export interface CamposHuella {
  readonly entidad: string;
  readonly moneda: string;
  readonly esquema: string;
  readonly monto: string;
  readonly plazo: number | null;
  /** Puntos extra sobre la tasa de tabla ("0.0" a "5.0"). */
  readonly puntosExtra?: string;
  /** Plazo especial con sus tasas acordadas; null o ausente = plazo de tabla. */
  readonly especial?: { readonly plazo: number; readonly tasaMensual: string | null; readonly tasaFinal: string | null } | null;
}

/** Identifica un juego de campos: dos huellas iguales significan los mismos campos. */
export function huellaDeCampos(c: CamposHuella): string {
  const especial = c.especial ?? null;
  return JSON.stringify([
    c.entidad,
    c.moneda,
    c.esquema,
    c.monto,
    c.plazo,
    c.puntosExtra ?? null,
    especial === null ? null : [especial.plazo, especial.tasaMensual, especial.tasaFinal],
  ]);
}

export interface EstadoConfirmacion<V> {
  /** Huella de los campos que hay ahora en el formulario. */
  readonly huellaActual: string;
  /** Última vista previa válida; null si no hay o si hubo un error. */
  readonly vistaPrevia: V | null;
  /** Huella de los campos con que se pidió esa vista previa. */
  readonly huellaVistaPrevia: string | null;
  /** La casilla "Confirmo que los números son correctos". */
  readonly confirmado: boolean;
}

export type AccionConfirmacion<V> =
  | { readonly tipo: "campoCambiado"; readonly huella: string }
  | { readonly tipo: "vistaPreviaRecibida"; readonly huella: string; readonly vistaPrevia: V | null }
  | { readonly tipo: "confirmar" }
  | { readonly tipo: "desconfirmar" };

export function estadoInicial<V>(huella: string): EstadoConfirmacion<V> {
  return { huellaActual: huella, vistaPrevia: null, huellaVistaPrevia: null, confirmado: false };
}

/** Hay una vista previa válida pedida con los campos actuales. */
export function vistaPreviaVigente<V>(e: EstadoConfirmacion<V>): boolean {
  return e.vistaPrevia !== null && e.huellaVistaPrevia === e.huellaActual;
}

const vigente = vistaPreviaVigente;

export function reducirConfirmacion<V>(
  estado: EstadoConfirmacion<V>,
  accion: AccionConfirmacion<V>,
): EstadoConfirmacion<V> {
  switch (accion.tipo) {
    case "campoCambiado":
      // Cualquier cambio en los campos borra la vista previa y la confirmación.
      return estadoInicial(accion.huella);
    case "vistaPreviaRecibida":
      // Una respuesta pedida con otros campos es vieja: se descarta.
      if (accion.huella !== estado.huellaActual) return estado;
      return { ...estado, vistaPrevia: accion.vistaPrevia, huellaVistaPrevia: accion.huella, confirmado: false };
    case "confirmar":
      return vigente(estado) ? { ...estado, confirmado: true } : estado;
    case "desconfirmar":
      return { ...estado, confirmado: false };
  }
}

/** El PDF exige vista previa válida, casilla marcada y huella coincidente. */
export function puedeGenerarPdf<V>(estado: EstadoConfirmacion<V>): boolean {
  return vigente(estado) && estado.confirmado;
}

/** Por qué el botón de PDF está deshabilitado; null si está habilitado. */
export function motivoPdfDeshabilitado<V>(estado: EstadoConfirmacion<V>): string | null {
  if (estado.vistaPrevia === null) return TEXTOS.motivoSinVistaPrevia;
  if (estado.huellaVistaPrevia !== estado.huellaActual) return TEXTOS.motivoVistaPreviaVieja;
  if (!estado.confirmado) return TEXTOS.motivoSinConfirmar;
  return null;
}
