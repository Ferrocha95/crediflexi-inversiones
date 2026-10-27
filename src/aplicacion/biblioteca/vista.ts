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
  /** Subcarpeta de la misma sección, o null: Sin carpeta. */
  readonly carpeta_id: string | null;
}

/** Columnas de biblioteca_carpetas que lee la pantalla. */
export interface FilaCarpeta {
  readonly id: string;
  readonly categoria: Categoria;
  readonly nombre: string;
  readonly archivado_en: string | null;
}

export interface CarpetaPantalla {
  readonly id: string;
  readonly categoria: Categoria;
  readonly nombre: string;
  readonly archivada: boolean;
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
  readonly carpetaId: string | null;
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

/** Tamaño legible, en base 1024 (4 MB = 4,194,304 bytes, el tope de la app). */
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
    carpetaId: f.carpeta_id,
  };
}

export function carpetaParaPantalla(f: FilaCarpeta): CarpetaPantalla {
  return { id: f.id, categoria: f.categoria, nombre: f.nombre, archivada: f.archivado_en !== null };
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

/**
 * Qué muestra la pantalla según haya algo o no. Vacía (sin elementos del modo
 * y, en activos, sin carpetas activas): el aviso de vacía. Director y Gerente,
 * fuera de "Ver archivados", ven además las 4 secciones, para poder crear la
 * primera carpeta con "Nueva carpeta".
 */
export function queMostrar(o: { readonly vacia: boolean; readonly administra: boolean; readonly archivados: boolean }): {
  readonly aviso: boolean;
  readonly secciones: boolean;
} {
  return { aviso: o.vacia, secciones: !o.vacia || (o.administra && !o.archivados) };
}

export interface GrupoCarpeta {
  readonly carpeta: CarpetaPantalla;
  /** Los del modo (activos o archivados) que coinciden con la búsqueda, por nombre. */
  readonly elementos: readonly ElementoPantalla[];
  /** Todos los elementos activos de la carpeta, sin importar la búsqueda: con 1 o más no se puede archivar. */
  readonly activos: number;
}

export interface GrupoSeccion {
  readonly categoria: Categoria;
  /** "Sin carpeta" va siempre primero. */
  readonly sinCarpeta: readonly ElementoPantalla[];
  readonly carpetas: readonly GrupoCarpeta[];
}

const porNombre = <T extends { readonly nombre: string }>(a: T, b: T) => comparar(a.nombre, b.nombre);

/**
 * Las 4 secciones en el orden del enum; en cada una, "Sin carpeta" y luego sus
 * carpetas por nombre. Con `archivados` falso: los elementos activos y las
 * carpetas activas (también las vacías). Con `archivados` verdadero: los
 * elementos archivados bajo su carpeta, aunque la carpeta esté archivada, y
 * solo las carpetas que tienen alguno. La búsqueda recorre todas las carpetas;
 * mientras se busca, las carpetas sin coincidencias no se devuelven. Un
 * elemento cuya carpeta no llegó se muestra en "Sin carpeta" para no perderlo.
 */
export function agruparPorCategoriaYCarpeta(
  elementos: readonly ElementoPantalla[],
  carpetas: readonly CarpetaPantalla[],
  opciones: { readonly archivados: boolean; readonly busqueda: string },
): GrupoSeccion[] {
  const buscando = normalizarBusqueda(opciones.busqueda) !== "";
  const idsCarpetas = new Set(carpetas.map((c) => c.id));
  const delModo = elementos.filter((e) => e.archivado === opciones.archivados);
  const visibles = delModo.filter((e) => coincideBusqueda(e.nombre, opciones.busqueda));

  return CATEGORIAS.map((categoria) => {
    const deSeccion = visibles.filter((e) => e.categoria === categoria);
    const sinCarpeta = deSeccion.filter((e) => e.carpetaId === null || !idsCarpetas.has(e.carpetaId)).sort(porNombre);
    const grupos = carpetas
      .filter((c) => c.categoria === categoria)
      .map((carpeta) => ({
        carpeta,
        elementos: deSeccion.filter((e) => e.carpetaId === carpeta.id).sort(porNombre),
        activos: elementos.filter((e) => !e.archivado && e.carpetaId === carpeta.id).length,
        delModo: delModo.some((e) => e.carpetaId === carpeta.id),
      }))
      .filter((g) => (opciones.archivados ? g.delModo : !g.carpeta.archivada))
      .filter((g) => !buscando || g.elementos.length > 0)
      .sort((a, b) => porNombre(a.carpeta, b.carpeta))
      .map(({ carpeta, elementos: es, activos }) => ({ carpeta, elementos: es, activos }));
    return { categoria, sinCarpeta, carpetas: grupos };
  });
}
