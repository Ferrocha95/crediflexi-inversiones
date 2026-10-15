import { CATEGORIAS, TIPOS, dominioDe, extensionDeRuta, type Categoria } from "./reglas";

/**
 * De las filas que RLS devolvió a lo que muestra la pantalla de la
 * Biblioteca: tipo, tamaño y fecha legibles, quién lo subió, el dominio de los
 * enlaces, la búsqueda por nombre (sin distinguir mayúsculas ni acentos) y el
 * agrupado por las 4 categorías. El navegador nunca recibe la ruta del
 * almacenamiento: los archivos se piden por id a /biblioteca/[id]/archivo.
 */

/** Columnas que lee la pantalla (src/servidor/biblioteca/consultas.ts). */
export interface FilaBiblioteca {
  readonly id: string;
  readonly categoria: Categoria;
  readonly nombre: string;
  readonly descripcion: string;
  readonly tipo: "ARCHIVO" | "ENLACE";
  readonly enlace: string | null;
  readonly ruta: string | null;
  readonly tipo_mime: string | null;
  readonly tamano_bytes: number | null;
  readonly subido_por_nombre: string;
  readonly creado_en: string;
  readonly archivado_en: string | null;
}

export interface ElementoPantalla {
  readonly id: string;
  readonly categoria: Categoria;
  readonly nombre: string;
  readonly descripcion: string;
  readonly esEnlace: boolean;
  /** "PDF", "DOCX"…, o "Enlace". */
  readonly tipo: string;
  readonly tamano: string | null;
  readonly fecha: string;
  readonly subidoPor: string;
  readonly archivado: boolean;
  /** Imagen, video o PDF: se puede ver en línea. */
  readonly previsualiza: boolean;
  readonly enlace: string | null;
  readonly dominio: string | null;
}

/** Sin mayúsculas, sin acentos (ni diéresis ni tilde de la ñ) y con un solo espacio. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function coincideBusqueda(nombre: string, busqueda: string): boolean {
  const b = normalizarBusqueda(busqueda);
  return b === "" || normalizarBusqueda(nombre).includes(b);
}

const numero = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

/** Tamaño legible, en base 1024 (25 MB = 26,214,400 bytes, el tope). */
export function tamanoEnTexto(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${numero.format(bytes / 1024)} KB`;
  return `${numero.format(bytes / (1024 * 1024))} MB`;
}

const fechaCorta = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Mexico_City" });

export function elementoParaPantalla(f: FilaBiblioteca, etiquetaEnlace = "Enlace"): ElementoPantalla {
  const ext = f.ruta === null ? null : extensionDeRuta(f.ruta);
  const esEnlace = f.tipo === "ENLACE";
  return {
    id: f.id,
    categoria: f.categoria,
    nombre: f.nombre,
    descripcion: f.descripcion,
    esEnlace,
    tipo: esEnlace ? etiquetaEnlace : ext === null ? "" : TIPOS[ext].etiqueta,
    tamano: f.tamano_bytes === null ? null : tamanoEnTexto(f.tamano_bytes),
    fecha: fechaCorta.format(new Date(f.creado_en)),
    subidoPor: f.subido_por_nombre,
    archivado: f.archivado_en !== null,
    previsualiza: !esEnlace && ext !== null && TIPOS[ext].previsualiza,
    enlace: esEnlace ? f.enlace : null,
    dominio: esEnlace && f.enlace !== null ? dominioDe(f.enlace) : null,
  };
}

export interface GrupoCategoria {
  readonly categoria: Categoria;
  readonly elementos: readonly ElementoPantalla[];
}

const comparar = new Intl.Collator("es-MX", { sensitivity: "base" }).compare;

/** Las 4 categorías en el orden del enum, cada una ordenada por nombre. */
export function agruparPorCategoria(elementos: readonly ElementoPantalla[]): GrupoCategoria[] {
  return CATEGORIAS.map((categoria) => ({
    categoria,
    elementos: elementos.filter((e) => e.categoria === categoria).sort((a, b) => comparar(a.nombre, b.nombre)),
  }));
}
