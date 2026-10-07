import type { ReactNode } from "react";
import { FONDO_ESTATUS, InsigniaEstatus, type EstatusPipeline } from "../ui/InsigniaEstatus";

/** Una fila del pipeline, ya formateada para mostrarse. Este componente no valida ni calcula. */
export interface FilaPipelineDatos {
  readonly id: string;
  readonly nombre: string;
  readonly contacto: string;
  readonly comentarios: string;
  readonly estatus: EstatusPipeline;
  readonly seguimiento: string;
  readonly ejecutivo: string;
  /** true: el seguimiento ya pasó (se marca junto a la fecha). */
  readonly vencido?: boolean;
}

export const COLUMNAS_PIPELINE = ["Nombre", "Contacto", "Comentarios", "Estatus", "Seguimiento", "Ejecutivo"] as const;

export const TEXTO_VENCIDO = "Vencido";

export interface OpcionesTablaPipeline {
  /** false: oculta la columna Ejecutivo (un ejecutivo solo ve lo suyo). */
  readonly mostrarEjecutivo?: boolean;
  /** Botones de cada fila; si devuelve null, la fila no tiene acciones (solo lectura). */
  readonly acciones?: (fila: FilaPipelineDatos) => ReactNode;
}

function Seguimiento({ fila }: { readonly fila: FilaPipelineDatos }) {
  return (
    <>
      {fila.seguimiento}
      {fila.vencido === true && (
        <span className="ml-2 inline-block rounded-md bg-marino px-1.5 py-0.5 text-xs font-bold text-hielo">{TEXTO_VENCIDO}</span>
      )}
    </>
  );
}

/** Fila de tabla pintada completa con el color de su estatus, como en el Excel. */
export function FilaPipeline({ fila, mostrarEjecutivo = true, acciones }: { readonly fila: FilaPipelineDatos } & OpcionesTablaPipeline) {
  const celda = "border-t border-marino/15 px-4 py-3 align-top";
  return (
    <tr className={`text-marino ${FONDO_ESTATUS[fila.estatus]}`}>
      <th scope="row" className={`${celda} text-left font-bold`}>
        {fila.nombre}
      </th>
      <td className={`${celda} whitespace-nowrap`}>{fila.contacto}</td>
      <td className={`${celda} min-w-48 text-left whitespace-pre-line`}>{fila.comentarios}</td>
      <td className={celda}>
        <InsigniaEstatus estatus={fila.estatus} />
      </td>
      <td className={`${celda} whitespace-nowrap`}>
        <Seguimiento fila={fila} />
      </td>
      {mostrarEjecutivo && <td className={celda}>{fila.ejecutivo}</td>}
      {acciones !== undefined && <td className={`${celda} py-1.5`}>{acciones(fila)}</td>}
    </tr>
  );
}

/** La misma fila como tarjeta, para el celular. */
function TarjetaPipeline({ fila, mostrarEjecutivo = true, acciones }: { readonly fila: FilaPipelineDatos } & OpcionesTablaPipeline) {
  const botones = acciones?.(fila);
  return (
    <li className={`rounded-2xl p-4 text-marino ${FONDO_ESTATUS[fila.estatus]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-lg font-bold">{fila.nombre}</p>
        <InsigniaEstatus estatus={fila.estatus} />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-semibold">{COLUMNAS_PIPELINE[1]}</dt>
        <dd>{fila.contacto}</dd>
        <dt className="font-semibold">{COLUMNAS_PIPELINE[4]}</dt>
        <dd>
          <Seguimiento fila={fila} />
        </dd>
        {mostrarEjecutivo && (
          <>
            <dt className="font-semibold">{COLUMNAS_PIPELINE[5]}</dt>
            <dd>{fila.ejecutivo}</dd>
          </>
        )}
      </dl>
      {fila.comentarios !== "" && <p className="mt-3 whitespace-pre-line">{fila.comentarios}</p>}
      {botones !== undefined && botones !== null && <div className="mt-3 flex flex-wrap gap-2">{botones}</div>}
    </li>
  );
}

/** Pipeline: tabla en pantallas anchas y tarjetas en el celular. */
export function TablaPipeline({
  titulo,
  filas,
  mostrarEjecutivo = true,
  acciones,
  etiquetaAcciones = "Acciones",
}: {
  readonly titulo: string;
  readonly filas: readonly FilaPipelineDatos[];
  readonly etiquetaAcciones?: string;
} & OpcionesTablaPipeline) {
  const columnas = COLUMNAS_PIPELINE.filter((c) => mostrarEjecutivo || c !== "Ejecutivo");
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-hielo/15 md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead className="bg-marino-alto text-hielo">
            <tr>
              {columnas.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-bold">
                  {c}
                </th>
              ))}
              {acciones !== undefined && (
                <th scope="col" className="px-4 py-3 font-bold">
                  {etiquetaAcciones}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaPipeline key={f.id} fila={f} mostrarEjecutivo={mostrarEjecutivo} acciones={acciones} />
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={titulo} className="flex flex-col gap-3 md:hidden">
        {filas.map((f) => (
          <TarjetaPipeline key={f.id} fila={f} mostrarEjecutivo={mostrarEjecutivo} acciones={acciones} />
        ))}
      </ul>
    </>
  );
}
