import type { Marcador } from "./textos";

export type ValoresMarcadores = Readonly<Partial<Record<Marcador, string>>>;

/**
 * Sustituye cada {marcador} de la plantilla por su valor, en una sola pasada:
 * el valor se inserta literal y no se vuelve a revisar. La carga de los textos
 * ya rechazó los marcadores desconocidos; si aun así falta un valor, es un
 * error de programación y se lanza.
 */
export function rellenar(plantilla: string, valores: ValoresMarcadores): string {
  return plantilla.replace(/\{([^{}]*)\}/g, (_, nombre: string) => {
    const valor = (valores as Readonly<Record<string, string | undefined>>)[nombre];
    if (valor === undefined) {
      throw new Error(`Falta el valor del marcador {${nombre}} para rellenar el texto "${plantilla}".`);
    }
    return valor;
  });
}
