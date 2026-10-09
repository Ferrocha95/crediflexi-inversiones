/**
 * Llena los marcadores {nombre} de una plantilla del archivo de textos con las
 * cifras que ya llegaron del servidor como texto. No calcula nada. Un marcador
 * sin valor se deja tal cual, para que se note en pantalla.
 */
export function llenar(plantilla: string, valores: Readonly<Record<string, string | number>>): string {
  return plantilla.replace(/\{([a-z_]+)\}/g, (todo, nombre: string) => (nombre in valores ? String(valores[nombre]) : todo));
}
