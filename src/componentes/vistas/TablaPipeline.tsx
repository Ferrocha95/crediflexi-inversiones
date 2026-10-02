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
}

export const COLUMNAS_PIPELINE = ["Nombre", "Contacto", "Comentarios", "Estatus", "Seguimiento", "Ejecutivo"] as const;

/** Fila de tabla pintada completa con el color de su estatus, como en el Excel. */
export function FilaPipeline({ fila }: { readonly fila: FilaPipelineDatos }) {
  const celda = "border-t border-marino/15 px-4 py-3 align-top";
  return (
    <tr className={`text-marino ${FONDO_ESTATUS[fila.estatus]}`}>
      <th scope="row" className={`${celda} text-left font-bold`}>
        {fila.nombre}
      </th>
      <td className={`${celda} whitespace-nowrap`}>{fila.contacto}</td>
      <td className={`${celda} min-w-64 text-left`}>{fila.comentarios}</td>
      <td className={celda}>
        <InsigniaEstatus estatus={fila.estatus} />
      </td>
      <td className={`${celda} whitespace-nowrap`}>{fila.seguimiento}</td>
      <td className={celda}>{fila.ejecutivo}</td>
    </tr>
  );
}

/** La misma fila como tarjeta, para el celular. */
function TarjetaPipeline({ fila }: { readonly fila: FilaPipelineDatos }) {
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
        <dd>{fila.seguimiento}</dd>
        <dt className="font-semibold">{COLUMNAS_PIPELINE[5]}</dt>
        <dd>{fila.ejecutivo}</dd>
      </dl>
      <p className="mt-3">{fila.comentarios}</p>
    </li>
  );
}

/** Pipeline: tabla en pantallas anchas y tarjetas en el celular. */
export function TablaPipeline({ titulo, filas }: { readonly titulo: string; readonly filas: readonly FilaPipelineDatos[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-hielo/15 md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead className="bg-marino-alto text-hielo">
            <tr>
              {COLUMNAS_PIPELINE.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-bold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <FilaPipeline key={f.id} fila={f} />
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={titulo} className="flex flex-col gap-3 md:hidden">
        {filas.map((f) => (
          <TarjetaPipeline key={f.id} fila={f} />
        ))}
      </ul>
    </>
  );
}
