import { pareceDatoSensible, type DatoSensible } from "../pipeline/datosSensibles";

/**
 * Reglas de la Biblioteca que no necesitan servidor: tipos permitidos por
 * extensión Y por los primeros bytes (nunca por el tipo que declara el
 * navegador), tamaño real, limpieza del nombre, enlaces https y datos
 * sensibles. Los topes son los mismos de la migración
 * 20261014120000_biblioteca.sql (una prueba los compara).
 *
 * DOCX, XLSX y PPTX necesitan además la revisión del ZIP, que vive en el
 * servidor (src/servidor/biblioteca/office.ts).
 */

/** 25 MiB: tope del archivo, igual que el bucket y la restricción de la tabla. */
export const TOPE_BYTES = 26_214_400;
/** Margen para los campos y separadores del formulario multipart. */
export const MARGEN_FORMULARIO = 64 * 1024;
/** Tope del cuerpo de POST /biblioteca/subir. */
export const TOPE_CUERPO = TOPE_BYTES + MARGEN_FORMULARIO;

export const LARGO_NOMBRE = 150;
export const LARGO_DESCRIPCION = 500;
export const LARGO_ENLACE = 500;

/** Tope del nombre de una subcarpeta (migración 20261022120000_biblioteca_carpetas.sql). */
export const LARGO_NOMBRE_CARPETA = 80;
/**
 * Máximo de subcarpetas activas por sección. Solo lo revisa la app al crear
 * (pendiente reforzarlo en la base y pasarlo a parámetros versionados).
 */
export const TOPE_CARPETAS = 30;

export const CATEGORIAS = ["HERRAMIENTAS", "MULTIMEDIA", "EMPRESA", "CAPACITACION"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export type Extension = "pdf" | "png" | "jpg" | "webp" | "gif" | "mp4" | "webm" | "docx" | "xlsx" | "pptx" | "txt" | "csv";
export type ExtensionOffice = "docx" | "xlsx" | "pptx";

export interface TipoPermitido {
  readonly mime: string;
  /** Etiqueta para la pantalla y los mensajes. */
  readonly etiqueta: string;
  /** Se puede ver en línea (imagen, video o PDF); lo demás siempre se descarga. */
  readonly previsualiza: boolean;
}

export const TIPOS: Readonly<Record<Extension, TipoPermitido>> = {
  pdf: { mime: "application/pdf", etiqueta: "PDF", previsualiza: true },
  png: { mime: "image/png", etiqueta: "PNG", previsualiza: true },
  jpg: { mime: "image/jpeg", etiqueta: "JPG", previsualiza: true },
  webp: { mime: "image/webp", etiqueta: "WEBP", previsualiza: true },
  gif: { mime: "image/gif", etiqueta: "GIF", previsualiza: true },
  mp4: { mime: "video/mp4", etiqueta: "MP4", previsualiza: true },
  webm: { mime: "video/webm", etiqueta: "WEBM", previsualiza: true },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", etiqueta: "DOCX", previsualiza: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", etiqueta: "XLSX", previsualiza: false },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", etiqueta: "PPTX", previsualiza: false },
  txt: { mime: "text/plain", etiqueta: "TXT", previsualiza: false },
  csv: { mime: "text/csv", etiqueta: "CSV", previsualiza: false },
};

/** Extensión escrita por el usuario → extensión con la que se guarda. */
const EXTENSIONES: Readonly<Record<string, Extension>> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  webp: "webp",
  gif: "gif",
  mp4: "mp4",
  webm: "webm",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  txt: "txt",
  csv: "csv",
};

const OFFICE_VIEJO_O_CON_MACROS = new Set(["doc", "xls", "ppt", "docm", "xlsm", "pptm", "dotm", "xltm", "potm", "ppsm", "xlsb", "dot", "xlt", "pot"]);

export const esOffice = (ext: Extension): ext is ExtensionOffice => ext === "docx" || ext === "xlsx" || ext === "pptx";

/** Extensión del tipo guardado, a partir de la ruta del almacenamiento. */
export function extensionDeRuta(ruta: string): Extension | null {
  const ext = extensionDe(ruta);
  return ext !== null && ext in TIPOS ? (ext as Extension) : null;
}

const LISTA_TIPOS = Object.values(TIPOS)
  .map((t) => t.etiqueta)
  .join(", ");

export const MENSAJES_BIBLIOTECA = {
  soloDirectorOGerente: "Solo el Director regional o el Gerente pueden subir, agregar o archivar en la Biblioteca.",
  origenAjeno: "La petición no viene de esta app. Abre la Biblioteca desde el menú y vuelve a intentar.",
  noEsFormulario: "La subida no llegó como formulario de archivo. Usa el botón Subir archivo de la Biblioteca.",
  incompleto: "El archivo llegó incompleto. Revisa tu conexión y vuelve a subirlo.",
  formularioIlegible: "No se pudo leer el formulario. Recarga la página y vuelve a subir el archivo.",
  sinArchivo: "Elige el archivo que quieres subir.",
  sinConfirmacion: "Marca la casilla para confirmar que el archivo no contiene datos personales de clientes ni datos bancarios.",
  vacio: "El archivo está vacío. Revisa que sea el correcto.",
  muyGrande:
    "El archivo pasa de 25 MB. Redúcelo o, si es un video, súbelo a una plataforma de video y agrégalo aquí como enlace https.",
  sinExtension: `El archivo no tiene extensión. Solo se aceptan: ${LISTA_TIPOS}.`,
  tipoNoPermitido: (ext: string) => `Los archivos .${ext} no se permiten en la Biblioteca. Solo se aceptan: ${LISTA_TIPOS}.`,
  officeViejoOMacros:
    "Los archivos de Office en formato viejo (.doc, .xls, .ppt) o con macros no se permiten. Ábrelo y guárdalo como .docx, .xlsx o .pptx sin macros.",
  firmaNoCoincide: (ext: string) =>
    `El contenido del archivo no corresponde a un .${ext}. Revisa que sea el archivo correcto y que no le hayan cambiado la extensión.`,
  officeConMacros: "El archivo trae macros. Por seguridad no se sube: guárdalo como .docx, .xlsx o .pptx sin macros.",
  officeConActivos:
    "El archivo trae controles ActiveX u objetos incrustados que pueden ejecutar programas. Por seguridad no se sube: quítalos y guárdalo de nuevo.",
  officeDanado:
    "El archivo de Office no pasó la revisión de seguridad: está dañado, cifrado con contraseña, es demasiado grande al descomprimirse o tiene una estructura que Office no escribe. Ábrelo, guárdalo de nuevo y vuelve a intentar.",
  nombreVacio: "Escribe un nombre para el elemento.",
  nombreLargo: `El nombre pasa de ${LARGO_NOMBRE} caracteres. Acórtalo.`,
  descripcionLarga: `La descripción pasa de ${LARGO_DESCRIPCION} caracteres. Acórtala.`,
  categoriaInvalida: "Elige una de las cuatro categorías.",
  enlaceInvalido: "Escribe un enlace completo que empiece con https://, por ejemplo https://www.ejemplo.com/video.",
  enlaceNoHttps: "Solo se aceptan enlaces https:// (seguros). Revisa el enlace.",
  enlaceConUsuario: "El enlace no puede llevar usuario ni contraseña. Quítalos y vuelve a intentar.",
  enlaceLargo: `El enlace pasa de ${LARGO_ENLACE} caracteres. Usa uno más corto.`,
  datoSensibleBase:
    "El nombre o la descripción parecen incluir un dato bancario o de identidad (CLABE, RFC o CURP). Esta app no los guarda: quítalo y vuelve a intentar.",
  fallaAlmacenamiento: "No se pudo guardar el archivo en el almacenamiento. Revisa que Supabase local esté corriendo (npm run db:start) y vuelve a intentar.",
  fallaGuardar: "No se pudo guardar en la Biblioteca. Vuelve a intentar; si sigue fallando, avisa al administrador.",
  fallaLectura: "No se pudo leer la Biblioteca. Revisa que Supabase local esté corriendo (npm run db:start) y recarga la página.",
  noEncontrado: "No se encontró el archivo. Puede que lo hayan archivado o que no tengas acceso; recarga la página.",
  idInvalido: "El elemento no es válido. Recarga la página y vuelve a intentar.",
  noSeArchivo: "No se archivó: el elemento no existe, ya estaba archivado o no es de tu organización. Recarga la página.",
  formaInvalida: "Los datos no llegaron completos. Recarga la página y vuelve a intentar.",
  carpetaNombreVacio: "Escribe un nombre para la carpeta.",
  carpetaNombreLargo: `El nombre de la carpeta pasa de ${LARGO_NOMBRE_CARPETA} caracteres. Acórtalo.`,
  carpetaRepetida: "Ya hay una carpeta activa con ese nombre en esta sección (sin importar mayúsculas). Usa otro nombre.",
  carpetaTope: `Esta sección ya tiene ${TOPE_CARPETAS} carpetas activas, el máximo. Archiva una vacía antes de crear otra.`,
  carpetaConElementos: "La carpeta todavía tiene elementos activos. Muévelos a otra carpeta o archívalos y vuelve a intentar.",
  carpetaArchivada: "Esa carpeta está archivada. Elige una carpeta activa o Sin carpeta.",
  carpetaInvalida: "La carpeta no es válida o no es de esta sección. Recarga la página y elige otra.",
  datoSensibleCarpeta:
    "El nombre de la carpeta parece incluir un dato bancario o de identidad (CLABE, RFC o CURP). Esta app no guarda datos bancarios ni de identidad: quítalo y vuelve a intentar.",
  noSeArchivoCarpeta: "No se archivó la carpeta: no existe, ya estaba archivada o no es de tu organización. Recarga la página.",
  noSeMovio: "No se movió: el elemento no existe, está archivado o no es de tu organización. Recarga la página.",
} as const;

// --- Nombres -----------------------------------------------------------------

// Controles (Cc), formato e invisibles (Cf: ancho cero, BOM, marcas y
// aislamientos de dirección como U+202E), separadores de línea y de párrafo, y
// rellenos que se ven en blanco (hangul, selectores de variación, U+034F).
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u3164\uFE00-\uFE0F\uFFA0]/gu;
const INVISIBLES_SIN_SALTO = /(?!\n)[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u3164\uFE00-\uFE0F\uFFA0]/gu;
const ESPACIOS_RAROS = /\p{Zs}/gu;

/**
 * Nombre original del archivo, limpio: solo la última parte (sin carpetas con
 * / ni \), NFC, sin controles ni invisibles, espacios normales, sin puntos al
 * inicio y con tope de 150 caracteres conservando la extensión. Solo sirve
 * para leer la extensión y como nombre por omisión: en el almacenamiento el
 * archivo se guarda con un nombre generado (uuid).
 */
export function limpiarNombreArchivo(original: string): string {
  const partes = original.normalize("NFC").split(/[/\\]/);
  let nombre = (partes[partes.length - 1] ?? "")
    .replace(INVISIBLES, "")
    .replace(ESPACIOS_RAROS, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  if (nombre.length > LARGO_NOMBRE) {
    const ext = extensionDe(nombre);
    const sufijo = ext !== null && ext.length < 10 ? `.${ext}` : "";
    nombre = nombre.slice(0, LARGO_NOMBRE - sufijo.length).trimEnd() + sufijo;
  }
  return nombre;
}

/** Texto libre (nombre o descripción): sin controles ni invisibles; conserva los saltos de línea. */
export function limpiarTexto(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLES_SIN_SALTO, "")
    .replace(ESPACIOS_RAROS, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Última extensión, en minúsculas; null si no hay. */
export function extensionDe(nombre: string): string | null {
  const punto = nombre.lastIndexOf(".");
  if (punto < 0 || punto === nombre.length - 1) return null;
  return nombre.slice(punto + 1).toLowerCase();
}

/** Nombre sin la última extensión. */
export function sinExtension(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto > 0 ? nombre.slice(0, punto).trim() : nombre;
}

export type ResultadoTipo = { readonly ok: true; readonly ext: Extension } | { readonly ok: false; readonly mensaje: string };

/** Tipo por la extensión del nombre (ya limpio). */
export function tipoPorNombre(nombre: string): ResultadoTipo {
  const ext = extensionDe(nombre);
  if (ext === null) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.sinExtension };
  const permitida = EXTENSIONES[ext];
  if (permitida !== undefined) return { ok: true, ext: permitida };
  if (OFFICE_VIEJO_O_CON_MACROS.has(ext)) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.officeViejoOMacros };
  return { ok: false, mensaje: MENSAJES_BIBLIOTECA.tipoNoPermitido(ext) };
}

/** null si el tamaño real se acepta; si no, el mensaje. */
export function revisarTamano(bytes: number): string | null {
  if (bytes <= 0) return MENSAJES_BIBLIOTECA.vacio;
  if (bytes > TOPE_BYTES) return MENSAJES_BIBLIOTECA.muyGrande;
  return null;
}

// --- Firmas (primeros bytes) --------------------------------------------------

const empiezaCon = (bytes: Uint8Array, firma: readonly number[], desde = 0) =>
  bytes.length >= desde + firma.length && firma.every((b, i) => bytes[desde + i] === b);
const ascii = (texto: string) => [...texto].map((c) => c.charCodeAt(0));

/** Busca "webm" como DocType en el encabezado EBML (primeros 64 bytes). */
function esWebm(bytes: Uint8Array): boolean {
  if (!empiezaCon(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return false;
  const encabezado = bytes.subarray(0, Math.min(64, bytes.length));
  const doctype = [0x42, 0x82];
  for (let i = 4; i + 2 + 1 + 4 <= encabezado.length; i++) {
    if (encabezado[i] === doctype[0] && encabezado[i + 1] === doctype[1]) {
      // Tamaño en una cifra EBML de 1 byte (0x84 = 4) seguido de "webm".
      return encabezado[i + 2] === 0x84 && empiezaCon(encabezado, ascii("webm"), i + 3);
    }
  }
  return false;
}

/** Texto UTF-8 válido y sin bytes nulos. */
export function esTextoUtf8(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * ¿Los primeros bytes corresponden a la extensión? Para DOCX, XLSX y PPTX
 * solo revisa que sea un ZIP: la revisión completa la hace el servidor.
 */
export function firmaCoincide(ext: Extension, bytes: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return empiezaCon(bytes, ascii("%PDF-"));
    case "png":
      return empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return empiezaCon(bytes, [0xff, 0xd8, 0xff]);
    case "webp":
      return empiezaCon(bytes, ascii("RIFF")) && empiezaCon(bytes, ascii("WEBP"), 8);
    case "gif":
      return empiezaCon(bytes, ascii("GIF87a")) || empiezaCon(bytes, ascii("GIF89a"));
    case "mp4":
      return empiezaCon(bytes, ascii("ftyp"), 4) && bytes.length >= 12;
    case "webm":
      return esWebm(bytes);
    case "docx":
    case "xlsx":
    case "pptx":
      return empiezaCon(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "txt":
    case "csv":
      return esTextoUtf8(bytes);
  }
}

// --- Enlaces -----------------------------------------------------------------

// El mismo patrón de host que la restricción biblioteca_enlace_https.
const HOST_VALIDO = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$/;

export type ResultadoEnlace =
  | { readonly ok: true; readonly url: string; readonly dominio: string }
  | { readonly ok: false; readonly mensaje: string };

/** Solo https, sin usuario ni contraseña; devuelve la URL normalizada y el dominio visible. */
export function validarEnlace(entrada: unknown): ResultadoEnlace {
  if (typeof entrada !== "string" || entrada.trim() === "") return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceInvalido };
  const texto = entrada.trim();
  if (/[\s\p{Cc}\p{Cf}]/u.test(texto)) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceInvalido };
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceInvalido };
  }
  if (url.protocol !== "https:") return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceNoHttps };
  if (url.username !== "" || url.password !== "") return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceConUsuario };
  if (!HOST_VALIDO.test(url.hostname)) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceInvalido };
  if (url.href.length > LARGO_ENLACE) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.enlaceLargo };
  return { ok: true, url: url.href, dominio: url.hostname };
}

/** Dominio de un enlace ya guardado (para mostrarlo junto al nombre). */
export function dominioDe(enlace: string): string {
  try {
    return new URL(enlace).hostname;
  } catch {
    return "";
  }
}

// --- Metadatos -----------------------------------------------------------------

export interface Metadatos {
  readonly nombre: string;
  readonly descripcion: string;
  readonly categoria: Categoria;
}

export type CampoBiblioteca = "nombre" | "descripcion" | "categoria" | "enlace" | "archivo" | "confirmacion" | "carpeta";
export type ErroresBiblioteca = Partial<Record<CampoBiblioteca, string>>;

export type ResultadoMetadatos = { readonly ok: true; readonly valor: Metadatos } | { readonly ok: false; readonly errores: ErroresBiblioteca };

const NOMBRE_DATO: Record<DatoSensible, string> = { CLABE: "una CLABE", CURP: "una CURP", RFC: "un RFC" };
const mensajeSensible = (campo: "nombre" | "descripcion", tipo: DatoSensible) =>
  `${campo === "nombre" ? "El nombre parece" : "La descripción parece"} incluir ${NOMBRE_DATO[tipo]}. Esta app no guarda datos bancarios ni de identidad: quítalo y vuelve a intentar.`;

const esCategoria = (valor: unknown): valor is Categoria => typeof valor === "string" && (CATEGORIAS as readonly string[]).includes(valor);

/** Nombre, descripción y categoría, limpios y revisados como los revisa la base. */
export function validarMetadatos(entrada: unknown): ResultadoMetadatos {
  if (typeof entrada !== "object" || entrada === null) return { ok: false, errores: { nombre: MENSAJES_BIBLIOTECA.formaInvalida } };
  const { nombre, descripcion, categoria } = entrada as Record<string, unknown>;
  const errores: ErroresBiblioteca = {};

  if (typeof nombre !== "string") errores.nombre = MENSAJES_BIBLIOTECA.nombreVacio;
  if (descripcion !== undefined && descripcion !== null && typeof descripcion !== "string") errores.descripcion = MENSAJES_BIBLIOTECA.formaInvalida;
  if (!esCategoria(categoria)) errores.categoria = MENSAJES_BIBLIOTECA.categoriaInvalida;

  const n = typeof nombre === "string" ? limpiarTexto(nombre).replace(/\n+/g, " ") : "";
  const d = typeof descripcion === "string" ? limpiarTexto(descripcion) : "";
  if (errores.nombre === undefined) {
    if (n === "") errores.nombre = MENSAJES_BIBLIOTECA.nombreVacio;
    else if (n.length > LARGO_NOMBRE) errores.nombre = MENSAJES_BIBLIOTECA.nombreLargo;
  }
  if (errores.descripcion === undefined && d.length > LARGO_DESCRIPCION) errores.descripcion = MENSAJES_BIBLIOTECA.descripcionLarga;

  // Como la base revisa nombre || ' ' || descripcion, también se revisan juntos.
  const enNombre = pareceDatoSensible(n);
  const enDescripcion = pareceDatoSensible(d);
  if (enNombre !== null) errores.nombre ??= mensajeSensible("nombre", enNombre);
  if (enDescripcion !== null) errores.descripcion ??= mensajeSensible("descripcion", enDescripcion);
  if (enNombre === null && enDescripcion === null && pareceDatoSensible(`${n} ${d}`) !== null) {
    errores.descripcion ??= MENSAJES_BIBLIOTECA.datoSensibleBase;
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, valor: { nombre: n, descripcion: d, categoria: categoria as Categoria } };
}

/** Mensaje en español para un error de la base al insertar o archivar. */
export function mensajeDeErrorBase(error: { code?: string; message?: string }): { mensaje: string; permisos: boolean; datos: boolean } {
  const texto = error.message ?? "";
  if (error.code === "42501") return { mensaje: MENSAJES_BIBLIOTECA.soloDirectorOGerente, permisos: true, datos: false };
  // Carpetas (migración 20261022120000_biblioteca_carpetas.sql), antes que las
  // de los elementos.
  const carpeta = mensajeDeErrorCarpeta(texto);
  if (carpeta !== null) return { mensaje: carpeta, permisos: false, datos: true };
  if (texto.includes("biblioteca_sin_datos_sensibles")) return { mensaje: MENSAJES_BIBLIOTECA.datoSensibleBase, permisos: false, datos: true };
  if (texto.includes("biblioteca_enlace_https")) return { mensaje: MENSAJES_BIBLIOTECA.enlaceInvalido, permisos: false, datos: true };
  if (texto.includes("biblioteca_nombre")) return { mensaje: MENSAJES_BIBLIOTECA.nombreLargo, permisos: false, datos: true };
  if (texto.includes("biblioteca_descripcion")) return { mensaje: MENSAJES_BIBLIOTECA.descripcionLarga, permisos: false, datos: true };
  if (texto.includes("biblioteca_tamano_maximo")) return { mensaje: MENSAJES_BIBLIOTECA.muyGrande, permisos: false, datos: true };
  return { mensaje: MENSAJES_BIBLIOTECA.fallaGuardar, permisos: false, datos: false };
}

/** Rechazos de la base propios de las carpetas, por nombre de restricción; null si no es uno de ellos. */
function mensajeDeErrorCarpeta(texto: string): string | null {
  if (texto.includes("biblioteca_carpetas_nombre_unico_activas")) return MENSAJES_BIBLIOTECA.carpetaRepetida;
  if (texto.includes("biblioteca_carpetas_sin_elementos_activos")) return MENSAJES_BIBLIOTECA.carpetaConElementos;
  if (texto.includes("biblioteca_restaurar_en_carpeta_archivada") || texto.includes("biblioteca_carpeta_archivada")) {
    return MENSAJES_BIBLIOTECA.carpetaArchivada;
  }
  if (texto.includes("biblioteca_carpeta_misma_seccion_y_organizacion")) return MENSAJES_BIBLIOTECA.carpetaInvalida;
  if (texto.includes("biblioteca_carpetas_sin_datos_sensibles")) return MENSAJES_BIBLIOTECA.datoSensibleCarpeta;
  if (texto.includes("biblioteca_carpetas_nombre_largo_maximo")) return MENSAJES_BIBLIOTECA.carpetaNombreLargo;
  if (texto.includes("biblioteca_carpetas_nombre")) return MENSAJES_BIBLIOTECA.carpetaNombreVacio;
  return null;
}

// --- Carpetas ------------------------------------------------------------------

export type ResultadoNombreCarpeta = { readonly ok: true; readonly nombre: string } | { readonly ok: false; readonly mensaje: string };

/**
 * Nombre de una subcarpeta, limpio y revisado como lo revisa la base: NFC, los
 * saltos de línea y tabuladores como un espacio, sin controles ni invisibles,
 * un solo espacio entre palabras, de 1 a 80 caracteres y sin datos sensibles.
 */
export function validarNombreCarpeta(entrada: unknown): ResultadoNombreCarpeta {
  if (typeof entrada !== "string") return { ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaNombreVacio };
  const nombre = limpiarTexto(entrada.replace(/[\t\n\r]+/g, " "));
  if (nombre === "") return { ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaNombreVacio };
  if (nombre.length > LARGO_NOMBRE_CARPETA) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaNombreLargo };
  if (pareceDatoSensible(nombre) !== null) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.datoSensibleCarpeta };
  return { ok: true, nombre };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoIdCarpeta = { readonly ok: true; readonly id: string | null } | { readonly ok: false; readonly mensaje: string };

/** Carpeta elegida: ausente, null o "" es Sin carpeta; si no, un uuid (en minúsculas). */
export function validarIdCarpeta(entrada: unknown): ResultadoIdCarpeta {
  if (entrada === undefined || entrada === null || entrada === "") return { ok: true, id: null };
  if (typeof entrada !== "string" || !UUID.test(entrada)) return { ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaInvalida };
  return { ok: true, id: entrada.toLowerCase() };
}

/** Director regional o Gerente: los únicos que suben, agregan y archivan. */
export const puedeAdministrar = (rol: string): boolean => rol === "DIRECTOR_REGIONAL" || rol === "GERENTE";
