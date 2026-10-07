/**
 * La app no guarda datos bancarios ni de identidad. Esta es la misma lógica
 * que privado.parece_dato_sensible (migración 20261005120000_prospectos.sql),
 * para avisar con un mensaje claro antes de que la base rechace el registro:
 *
 *   CLABE: exactamente 18 dígitos, seguidos o separados por un espacio o un
 *          guion, sin más dígitos pegados antes ni después.
 *   CURP:  4 letras, fecha AAMMDD, sexo, entidad, 3 consonantes, 2 caracteres.
 *   RFC:   3 o 4 letras, fecha AAMMDD y homoclave de 3 caracteres.
 *
 * CURP y RFC van con límites de palabra como \m y \M de Postgres: antes no
 * hay letra, dígito ni guion bajo y el primer carácter sí es de palabra; al
 * final no sigue ninguno. Por eso un correo como prospecto900101abc@... no se
 * marca. Sin distinguir mayúsculas.
 */

export type DatoSensible = "CLABE" | "CURP" | "RFC";

const RE_GRUPO_DIGITOS = /[0-9]+(?:[ -][0-9]+)*/g;
const INICIO = "(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])";
const FIN = "(?![\\p{L}\\p{N}_])";
const FECHA = "[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])";
const RE_CURP = new RegExp(`${INICIO}[A-Z][AEIOUX][A-Z]{2}${FECHA}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]${FIN}`, "iu");
const RE_RFC = new RegExp(`${INICIO}[A-ZÑ&]{3,4}${FECHA}[A-Z0-9]{3}${FIN}`, "iu");

/** "CLABE", "CURP", "RFC" o null, en el mismo orden de revisión que la base. */
export function pareceDatoSensible(texto: string): DatoSensible | null {
  for (const m of texto.matchAll(RE_GRUPO_DIGITOS)) {
    if (m[0].replace(/[^0-9]/g, "").length === 18) return "CLABE";
  }
  if (RE_CURP.test(texto)) return "CURP";
  if (RE_RFC.test(texto)) return "RFC";
  return null;
}

const NOMBRE_DATO: Record<DatoSensible, { articulo: string; pronombre: string }> = {
  CLABE: { articulo: "una CLABE", pronombre: "quítala" },
  CURP: { articulo: "una CURP", pronombre: "quítala" },
  RFC: { articulo: "un RFC", pronombre: "quítalo" },
};

export const MENSAJE_DATO_SENSIBLE_GENERAL =
  "El nombre o los comentarios parecen incluir un dato bancario o de identidad (CLABE, RFC o CURP). Esta app no los guarda: quítalo y guarda de nuevo.";

function mensaje(campo: "nombre" | "comentarios", tipo: DatoSensible): string {
  const { articulo, pronombre } = NOMBRE_DATO[tipo];
  const sujeto = campo === "nombre" ? "El nombre parece" : "Los comentarios parecen";
  return `${sujeto} incluir ${articulo}. Esta app no guarda datos bancarios ni de identidad: ${pronombre} y guarda de nuevo.`;
}

/**
 * Error por campo si el nombre o los comentarios parecen traer un dato
 * sensible. Como la base revisa `nombre || ' ' || comentarios`, también se
 * revisan juntos: 18 dígitos repartidos entre los dos se marcan en comentarios.
 */
export function revisarDatosSensibles(campos: { nombre: string; comentarios: string }): Partial<Record<"nombre" | "comentarios", string>> {
  const errores: Partial<Record<"nombre" | "comentarios", string>> = {};
  const enNombre = pareceDatoSensible(campos.nombre);
  const enComentarios = pareceDatoSensible(campos.comentarios);
  if (enNombre !== null) errores.nombre = mensaje("nombre", enNombre);
  if (enComentarios !== null) errores.comentarios = mensaje("comentarios", enComentarios);
  if (enNombre === null && enComentarios === null && pareceDatoSensible(`${campos.nombre} ${campos.comentarios}`) !== null) {
    errores.comentarios = MENSAJE_DATO_SENSIBLE_GENERAL;
  }
  return errores;
}
