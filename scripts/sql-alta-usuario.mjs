// Imprime el SQL para dar de alta un usuario de la app en un proyecto de
// Supabase en la nube. NO se conecta a nada, no lee el entorno, archivos ni
// llaves: solo valida los argumentos y escribe SQL en la salida estándar, para
// revisarlo y pegarlo en el editor de SQL del proyecto.
//
//   node scripts/sql-alta-usuario.mjs --auth-id <uuid> --nombre "Ana Sintética" \
//     --rol EJECUTIVO --sucursal Centro [--jefe-id <uuid>] \
//     [--crear-sucursal --organizacion "Organización Sintética"]
//
// --auth-id es el uuid de la cuenta creada a mano en el panel de Supabase
// (Authentication); --jefe-id es el usuarios.id del jefe (lo devuelve el SQL de
// su alta). Los textos solo van dentro de literales '…' con la comilla simple
// duplicada; la barra invertida y los caracteres de control o invisibles se
// rechazan, así el SQL no depende de standard_conforming_strings.

import { pathToFileURL } from "node:url";

export const ROLES = ["DIRECTOR_REGIONAL", "GERENTE", "EJECUTIVO"];
const LARGO_MAXIMO = 150;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Control (Cc), formato (Cf: ancho cero, bidi, BOM) y separadores de línea y párrafo.
const RE_INVISIBLES = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

const CON_VALOR = ["auth-id", "nombre", "rol", "sucursal", "jefe-id", "organizacion"];
const SIN_VALOR = ["crear-sucursal"];
const OBLIGATORIAS = ["auth-id", "nombre", "rol", "sucursal"];

function uuid(bandera, valor) {
  const v = valor.trim();
  if (!RE_UUID.test(v)) throw new Error(`--${bandera} debe ser un uuid como 0b6f7c1e-3a2d-4f5b-9c8e-1d2a3b4c5d6e.`);
  return v.toLowerCase();
}

function texto(bandera, valor) {
  if (RE_INVISIBLES.test(valor)) {
    throw new Error(`--${bandera} trae caracteres de control o invisibles (por ejemplo, un salto de línea). Escríbelo en una sola línea, solo con letras, números y signos visibles.`);
  }
  if (valor.includes("\\")) throw new Error(`--${bandera} trae una barra invertida (\\). Quítala y vuelve a intentar.`);
  const v = valor.trim();
  const largo = [...v].length;
  if (largo < 1 || largo > LARGO_MAXIMO) throw new Error(`--${bandera} debe tener de 1 a ${LARGO_MAXIMO} caracteres (ahora tiene ${largo}).`);
  return v;
}

/** Valida los argumentos; lanza un Error con el mensaje para la persona. */
export function parsearArgumentos(argv) {
  const valores = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const m = /^--([a-z-]+)(?:=([\s\S]*))?$/.exec(arg);
    const bandera = m?.[1];
    if (!m || (!CON_VALOR.includes(bandera) && !SIN_VALOR.includes(bandera))) {
      throw new Error(`Bandera desconocida: ${RE_INVISIBLES.test(arg) ? "(con caracteres invisibles)" : arg}. Usa --auth-id, --nombre, --rol, --sucursal, --jefe-id, --crear-sucursal y --organizacion.`);
    }
    if (bandera in valores) throw new Error(`La bandera --${bandera} va repetida: ponla una sola vez.`);
    if (SIN_VALOR.includes(bandera)) {
      if (m[2] !== undefined) throw new Error(`--${bandera} no lleva valor.`);
      valores[bandera] = true;
    } else if (m[2] !== undefined) valores[bandera] = m[2];
    else valores[bandera] = argv[++i] ?? "";
  }

  const faltan = OBLIGATORIAS.filter((b) => !(b in valores));
  if (faltan.length > 0) throw new Error(`Faltan banderas: ${faltan.map((b) => `--${b}`).join(", ")}.`);

  const rol = valores.rol.trim().toUpperCase();
  if (!ROLES.includes(rol)) throw new Error(`El rol no existe: usa ${ROLES.join(", ")}.`);
  const crearSucursal = valores["crear-sucursal"] === true;
  if (crearSucursal && !("organizacion" in valores)) {
    throw new Error("--crear-sucursal necesita --organizacion: el nombre de la organización donde va la sucursal.");
  }

  return {
    authId: uuid("auth-id", valores["auth-id"]),
    nombre: texto("nombre", valores.nombre),
    rol,
    sucursal: texto("sucursal", valores.sucursal),
    jefeId: "jefe-id" in valores ? uuid("jefe-id", valores["jefe-id"]) : null,
    crearSucursal,
    organizacion: "organizacion" in valores ? texto("organizacion", valores.organizacion) : null,
  };
}

/** Literal de SQL: comillas simples, con la comilla simple duplicada. */
export function literal(valor) {
  return `'${valor.replaceAll("'", "''")}'`;
}

const igualA = (columna, valor) => `lower(btrim(${columna})) = lower(btrim(${literal(valor)}))`;

/** SQL de la alta (y, si se pide, de la organización y la sucursal), en una transacción. */
export function generarSql({ authId, nombre, rol, sucursal, jefeId, crearSucursal, organizacion }) {
  const partes = [
    "-- SQL generado por scripts/sql-alta-usuario.mjs. Revísalo antes de correrlo.",
    "-- Si algo falla, la transacción completa se deshace y no queda nada a medias.",
    "begin;",
    "",
  ];

  if (crearSucursal) {
    partes.push(
      "-- Organización, solo si no existe (el nombre se compara sin mayúsculas ni espacios en los extremos).",
      "insert into public.organizaciones (nombre)",
      `select ${literal(organizacion)}`,
      `where not exists (select 1 from public.organizaciones where ${igualA("nombre", organizacion)});`,
      "",
      "-- Sucursal, solo si no existe en esa organización.",
      "insert into public.sucursales (organizacion_id, nombre)",
      `select o.id, ${literal(sucursal)}`,
      "from public.organizaciones o",
      `where ${igualA("o.nombre", organizacion)}`,
      `and not exists (select 1 from public.sucursales s where s.organizacion_id = o.id and ${igualA("s.nombre", sucursal)});`,
      "",
    );
  }

  // Subconsulta escalar: si no hay sucursal queda nula y la inserción falla; si
  // el nombre se repite entre organizaciones, falla por devolver más de una fila.
  const subSucursal =
    organizacion === null
      ? `(select s.id from public.sucursales s where ${igualA("s.nombre", sucursal)})`
      : `(select s.id from public.sucursales s join public.organizaciones o on o.id = s.organizacion_id where ${igualA("s.nombre", sucursal)} and ${igualA("o.nombre", organizacion)})`;

  partes.push(
    "-- Usuario. Si la sucursal no existe o su nombre se repite entre organizaciones, falla y no inserta.",
    "insert into public.usuarios (auth_id, nombre, rol, sucursal_id, jefe_id)",
    "select",
    `  ${literal(authId)}::uuid,`,
    `  ${literal(nombre)},`,
    `  ${literal(rol)}::public.rol_usuario,`,
    `  ${subSucursal},`,
    `  ${jefeId === null ? "null" : `${literal(jefeId)}::uuid`}`,
    "returning id, nombre, rol;",
    "",
    "commit;",
    "",
  );
  return partes.join("\n");
}

function principal() {
  try {
    process.stdout.write(generarSql(parsearArgumentos(process.argv.slice(2))));
  } catch (e) {
    process.stderr.write(`No se generó SQL. ${e.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
