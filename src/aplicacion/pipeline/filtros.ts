import { esFechaReal, ESTATUS, type Estatus } from "./normalizar";
import { semanaDe } from "./semana";

/**
 * Filtros del pipeline. Viven en la URL
 * (?estatus=&q=&vencido=1&ejecutivo=&semana=AAAA-MM-DD&archivados=1) y se
 * aplican en la app sobre las filas que el usuario ya puede ver (RLS decide
 * cuáles): la búsqueda no va a SQL.
 */

/** Un prospecto tal como lo lee la app (src/servidor/pipeline/consultas.ts). */
export interface ProspectoFila {
  readonly id: string;
  readonly ejecutivoId: string;
  /** Nombre del ejecutivo dueño. */
  readonly ejecutivo: string;
  readonly nombre: string;
  readonly contacto: string;
  readonly comentarios: string;
  readonly estatus: Estatus;
  /** AAAA-MM-DD o null. */
  readonly seguimiento: string | null;
  readonly archivadoEn: string | null;
}

export interface Filtros {
  readonly estatus: Estatus | null;
  readonly q: string;
  readonly vencido: boolean;
  readonly ejecutivo: string | null;
  /** Lunes de la semana elegida (solo cambia el encabezado del Excel), o null = la actual. */
  readonly semana: string | null;
  readonly archivados: boolean;
  /** Abre el diálogo de alta al cargar (acceso "Nuevo prospecto" del Inicio). */
  readonly nuevo: boolean;
}

export type ParametrosUrl = Record<string, string | string[] | undefined>;

const LARGO_BUSQUEDA = 100;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_ISO = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

/** Un parámetro repetido (?a=1&a=2) se trata como ausente. */
const uno = (v: string | string[] | undefined): string | undefined => (typeof v === "string" ? v : undefined);

export function leerFiltros(params: ParametrosUrl): Filtros {
  const estatus = uno(params.estatus);
  const ejecutivo = uno(params.ejecutivo);
  const semana = uno(params.semana);
  const iso = semana === undefined ? null : RE_ISO.exec(semana);
  return {
    estatus: estatus !== undefined && (ESTATUS as readonly string[]).includes(estatus) ? (estatus as Estatus) : null,
    q: Array.from((uno(params.q) ?? "").trim()).slice(0, LARGO_BUSQUEDA).join(""),
    vencido: uno(params.vencido) === "1",
    ejecutivo: ejecutivo !== undefined && RE_UUID.test(ejecutivo) ? ejecutivo : null,
    semana: iso !== null && esFechaReal(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? semanaDe(semana!).lunes : null,
    archivados: uno(params.archivados) === "1",
    nuevo: uno(params.nuevo) === "1",
  };
}

/** Minúsculas y sin acentos ni diéresis: "José ÑÚÑEZ" -> "jose nunez". */
export function textoDeBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Seguimiento vencido: fecha anterior a hoy (Ciudad de México), solo en activos. */
export function esVencido(fila: Pick<ProspectoFila, "seguimiento" | "archivadoEn">, hoy: string): boolean {
  return fila.archivadoEn === null && fila.seguimiento !== null && fila.seguimiento < hoy;
}

/** Aplica estatus, búsqueda por nombre, vencidos y ejecutivo. No filtra por semana. */
export function aplicarFiltros(filas: readonly ProspectoFila[], f: Filtros, hoy: string): ProspectoFila[] {
  const q = textoDeBusqueda(f.q);
  return filas.filter(
    (p) =>
      (f.estatus === null || p.estatus === f.estatus) &&
      (f.ejecutivo === null || p.ejecutivoId === f.ejecutivo) &&
      (!f.vencido || esVencido(p, hoy)) &&
      (q === "" || textoDeBusqueda(p.nombre).includes(q)),
  );
}

export type Conteo = Record<Estatus, number> & { readonly total: number };

export function contarPorEstatus(filas: readonly Pick<ProspectoFila, "estatus">[]): Conteo {
  const c = { INTERESADO: 0, INTERMITENTE: 0, NO_INTERESADO: 0 };
  for (const f of filas) c[f.estatus] += 1;
  return { ...c, total: filas.length };
}

/** URL de /pipeline con los filtros dados más los cambios. Nunca lleva nuevo=1. */
export function hrefPipeline(f: Filtros, cambios: Partial<Omit<Filtros, "nuevo">> = {}): string {
  const g = { ...f, ...cambios };
  const p = new URLSearchParams();
  if (g.estatus !== null) p.set("estatus", g.estatus);
  if (g.q !== "") p.set("q", g.q);
  if (g.vencido) p.set("vencido", "1");
  if (g.ejecutivo !== null) p.set("ejecutivo", g.ejecutivo);
  if (g.semana !== null) p.set("semana", g.semana);
  if (g.archivados) p.set("archivados", "1");
  const consulta = p.toString().replace(/\+/g, "%20");
  return consulta === "" ? "/pipeline" : `/pipeline?${consulta}`;
}
