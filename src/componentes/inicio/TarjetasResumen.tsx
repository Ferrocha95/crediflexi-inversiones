import { CalendarClock, CalendarDays, Circle, CircleCheck, FileClock, Hourglass, Kanban, Send, Target, TrendingUp, Wallet } from "lucide-react";
import { Esqueleto } from "../ui/Esqueleto";
import { ESTATUS_PIPELINE, FONDO_ESTATUS, InsigniaEstatus, type EstatusPipeline } from "../ui/InsigniaEstatus";
import { NumeroAnimado } from "../ui/NumeroAnimado";
import type { Lugar } from "../vistas/CuadriculaSemanal";
import { InsigniaVigencia, type Vigencia } from "../vistas/TarjetaDocumento";
import { AnilloAvance, AnilloVacio } from "./AnilloAvance";
import { TarjetaResumen } from "./TarjetaResumen";

/*
 * Tarjetas de resumen del inicio. Solo presentan: si no reciben `datos` se
 * muestran como "Próximamente", con una silueta sin datos. Ninguna calcula:
 * las cifras llegan ya formateadas.
 */

function Lineas({ n }: { readonly n: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: n }, (_, i) => (
        <Esqueleto key={i} quieto className={`h-4 ${i % 2 === 0 ? "w-full" : "w-4/5"}`} />
      ))}
    </div>
  );
}

// Meta del mes ---------------------------------------------------------------

export interface DatosMeta {
  /** De 0 a 1, solo para dibujar el anillo. */
  readonly fraccion: number;
  readonly porcentaje: string;
  readonly logrado: string;
  readonly meta: string;
}

export function TarjetaMeta({ datos }: { readonly datos?: DatosMeta }) {
  return (
    <TarjetaResumen
      titulo="Meta del mes"
      Icono={Target}
      modulo="Se activa con el módulo de Metas."
      proximamente={datos === undefined}
      esqueleto={
        <div className="flex items-center gap-5">
          <AnilloVacio />
          <div className="flex-1"><Lineas n={2} /></div>
        </div>
      }
    >
      {datos !== undefined && (
        <div className="flex items-center gap-5">
          <AnilloAvance fraccion={datos.fraccion} etiqueta={datos.porcentaje} descripcion={`${datos.porcentaje} de avance de la meta del mes`} />
          <dl className="flex flex-col gap-1">
            <dt className="text-sm font-semibold text-hielo-tenue">Captado</dt>
            <dd className="text-lg font-extrabold"><NumeroAnimado valor={datos.logrado} /></dd>
            <dt className="mt-1 text-sm font-semibold text-hielo-tenue">Meta</dt>
            <dd className="font-bold">{datos.meta}</dd>
          </dl>
        </div>
      )}
    </TarjetaResumen>
  );
}

// Pipeline por estatus -------------------------------------------------------

export interface DatosPipelineEstatus {
  /** Número de prospectos por estatus (conteos, no dinero). */
  readonly conteos: Readonly<Record<EstatusPipeline, number>>;
}

export function TarjetaPipelineEstatus({ datos }: { readonly datos?: DatosPipelineEstatus }) {
  return (
    <TarjetaResumen
      titulo="Pipeline por estatus"
      Icono={Kanban}
      modulo="Se activa con el módulo de Pipeline."
      proximamente={datos === undefined}
      esqueleto={
        <div className="flex flex-col gap-4">
          <Esqueleto quieto className="h-3 w-full rounded-full" />
          <Lineas n={3} />
        </div>
      }
    >
      {datos !== undefined && (
        <div className="flex flex-col gap-4">
          <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-hielo/10">
            {ESTATUS_PIPELINE.map((e) => (
              <span key={e} className={FONDO_ESTATUS[e]} style={{ flexGrow: datos.conteos[e] }} />
            ))}
          </div>
          <ul className="flex flex-col gap-2">
            {ESTATUS_PIPELINE.map((e) => (
              <li key={e} className="flex items-center justify-between gap-3">
                <InsigniaEstatus estatus={e} />
                <span className="text-lg font-extrabold">{datos.conteos[e]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TarjetaResumen>
  );
}

// Seguimientos de hoy --------------------------------------------------------

export interface DatosSeguimientos {
  readonly filas: readonly { readonly id: string; readonly nombre: string; readonly estatus: EstatusPipeline; readonly nota: string }[];
}

export function TarjetaSeguimientos({ datos }: { readonly datos?: DatosSeguimientos }) {
  return (
    <TarjetaResumen
      titulo="Seguimientos de hoy"
      Icono={CalendarClock}
      modulo="Se activa con el módulo de Pipeline."
      proximamente={datos === undefined}
      esqueleto={<Lineas n={3} />}
    >
      {datos !== undefined &&
        (datos.filas.length === 0 ? (
          <p className="text-hielo">No hay seguimientos para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {datos.filas.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 border-t border-hielo/10 pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{f.nombre}</span>
                  <InsigniaEstatus estatus={f.estatus} />
                </div>
                <span className="text-sm text-hielo">{f.nota}</span>
              </li>
            ))}
          </ul>
        ))}
    </TarjetaResumen>
  );
}

// Proyección de la semana ----------------------------------------------------

export interface DatosProyeccionSemana {
  /** Suma simple de las cantidades, ya calculada (como el total del Excel). */
  readonly total: string;
  /** Por ejemplo "4 inversionistas". */
  readonly detalle: string;
  /** Por ejemplo "Del 5 al 9 de octubre". */
  readonly semana: string;
}

export function TarjetaProyeccionSemana({ datos }: { readonly datos?: DatosProyeccionSemana }) {
  return (
    <TarjetaResumen
      titulo="Proyección de la semana"
      Icono={TrendingUp}
      modulo="Se activa con el módulo de Proyección."
      proximamente={datos === undefined}
      esqueleto={
        <div className="flex flex-col gap-3">
          <Esqueleto quieto className="h-10 w-2/3" />
          <Lineas n={1} />
        </div>
      }
    >
      {datos !== undefined && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-hielo-tenue">{datos.semana}</p>
          <p className="text-3xl font-extrabold text-verde"><NumeroAnimado valor={datos.total} /></p>
          <p className="text-sm text-hielo">{datos.detalle}</p>
        </div>
      )}
    </TarjetaResumen>
  );
}

// Plan de hoy ----------------------------------------------------------------

export interface DatosPlanHoy {
  readonly bloques: readonly { readonly hora: string; readonly donde: Lugar; readonly que: string }[];
}

export function TarjetaPlanHoy({ datos }: { readonly datos?: DatosPlanHoy }) {
  return (
    <TarjetaResumen
      titulo="Plan de hoy"
      Icono={CalendarDays}
      modulo="Se activa con el módulo de Plan semanal."
      proximamente={datos === undefined}
      esqueleto={<Lineas n={4} />}
    >
      {datos !== undefined &&
        (datos.bloques.length === 0 ? (
          <p className="text-hielo">No hay actividades planeadas para hoy.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {datos.bloques.map((b) => (
              <li key={b.hora} className="grid grid-cols-[3.5rem_5.5rem_1fr] items-center gap-3">
                <span className="font-bold text-hielo">{b.hora}</span>
                <span className="justify-self-start rounded-md bg-hielo/15 px-2 py-0.5 text-sm font-semibold">{b.donde}</span>
                <span className="min-w-0">{b.que}</span>
              </li>
            ))}
          </ol>
        ))}
    </TarjetaResumen>
  );
}

// Envío del viernes ----------------------------------------------------------

export interface DatosEnvioViernes {
  /** Por ejemplo "Viernes 9 de octubre". */
  readonly fecha: string;
  readonly archivos: readonly { readonly nombre: string; readonly listo: boolean }[];
}

export function TarjetaEnvioViernes({ datos }: { readonly datos?: DatosEnvioViernes }) {
  return (
    <TarjetaResumen
      titulo="Envío del viernes"
      Icono={Send}
      modulo="Se activa cuando estén los módulos de Pipeline, Plan semanal y Proyección."
      proximamente={datos === undefined}
      esqueleto={<Lineas n={2} />}
    >
      {datos !== undefined && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-hielo-tenue">{datos.fecha}</p>
          <ul className="flex flex-col gap-2">
            {datos.archivos.map((a) => (
              <li key={a.nombre} className="flex items-start gap-2.5">
                {a.listo ? (
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-verde-texto" />
                ) : (
                  <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-hielo-tenue" />
                )}
                <span className="min-w-0 break-all">
                  {a.nombre}
                  <span className="block text-sm text-hielo">{a.listo ? "Listo" : "Pendiente"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TarjetaResumen>
  );
}

// Cartera total --------------------------------------------------------------

export interface DatosCarteraTotal {
  /** Suma de la cartera, ya calculada y formateada. */
  readonly total: string;
  /** Por ejemplo "12 clientes con inversión vigente". */
  readonly detalle: string;
}

export function TarjetaCarteraTotal({ datos }: { readonly datos?: DatosCarteraTotal }) {
  return (
    <TarjetaResumen
      titulo="Cartera total"
      Icono={Wallet}
      modulo="Se activa con el módulo de Cartera."
      proximamente={datos === undefined}
      esqueleto={
        <div className="flex flex-col gap-3">
          <Esqueleto quieto className="h-10 w-3/4" />
          <Lineas n={1} />
        </div>
      }
    >
      {datos !== undefined && (
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-extrabold"><NumeroAnimado valor={datos.total} /></p>
          <p className="text-sm text-hielo">{datos.detalle}</p>
        </div>
      )}
    </TarjetaResumen>
  );
}

// Vencimientos de los próximos 30 días ----------------------------------------

export interface DatosVencimientos {
  readonly filas: readonly { readonly id: string; readonly nombre: string; readonly monto: string; readonly fecha: string }[];
}

export function TarjetaVencimientos({ datos }: { readonly datos?: DatosVencimientos }) {
  return (
    <TarjetaResumen
      titulo="Vencimientos de los próximos 30 días"
      Icono={Hourglass}
      modulo="Se activa con el módulo de Cartera."
      proximamente={datos === undefined}
      esqueleto={<Lineas n={3} />}
    >
      {datos !== undefined &&
        (datos.filas.length === 0 ? (
          <p className="text-hielo">No hay vencimientos en los próximos 30 días.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {datos.filas.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-3 border-t border-hielo/10 pt-3 first:border-t-0 first:pt-0">
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{f.nombre}</span>
                  <span className="text-sm text-hielo">Vence el {f.fecha}</span>
                </span>
                <span className="font-extrabold whitespace-nowrap">{f.monto}</span>
              </li>
            ))}
          </ul>
        ))}
    </TarjetaResumen>
  );
}

// Documentos por vencer ------------------------------------------------------

export interface DatosDocumentosPorVencer {
  readonly filas: readonly { readonly id: string; readonly nombre: string; readonly vigencia: Vigencia; readonly fecha: string }[];
}

export function TarjetaDocumentosPorVencer({ datos }: { readonly datos?: DatosDocumentosPorVencer }) {
  return (
    <TarjetaResumen
      titulo="Documentos por vencer"
      Icono={FileClock}
      modulo="Se activa con el módulo de Biblioteca."
      proximamente={datos === undefined}
      esqueleto={<Lineas n={3} />}
    >
      {datos !== undefined &&
        (datos.filas.length === 0 ? (
          <p className="text-hielo">No hay documentos por vencer.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {datos.filas.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 border-t border-hielo/10 pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{f.nombre}</span>
                  <InsigniaVigencia vigencia={f.vigencia} />
                </div>
                <span className="text-sm text-hielo">{f.fecha}</span>
              </li>
            ))}
          </ul>
        ))}
    </TarjetaResumen>
  );
}
