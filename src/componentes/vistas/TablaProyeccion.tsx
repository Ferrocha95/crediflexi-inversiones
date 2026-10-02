/** Una fila de la proyección, ya formateada. Este componente no suma ni pondera. */
export interface FilaProyeccion {
  readonly id: string;
  readonly fecha: string;
  readonly ejecutivo: string;
  readonly cantidad: string;
  readonly cierre: string;
  readonly inversionista: string;
}

const COLUMNAS = { fecha: "Fecha", ejecutivo: "Ejecutivo", cantidad: "Cantidad", cierre: "% de cierre", inversionista: "Inversionista" } as const;
const ETIQUETA_TOTAL = "Total";

export interface PropsTablaProyeccion {
  readonly titulo: string;
  readonly filas: readonly FilaProyeccion[];
  /** El total ya calculado por quien llama (texto formateado). */
  readonly total: string;
}

/** Proyección semanal: tabla desde 768 px y tarjetas en el celular, con el total al final. */
export function TablaProyeccion({ titulo, filas, total }: PropsTablaProyeccion) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-hielo/15 md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead className="bg-marino-alto text-hielo">
            <tr>
              <th scope="col" className="px-4 py-3">{COLUMNAS.fecha}</th>
              <th scope="col" className="px-4 py-3">{COLUMNAS.ejecutivo}</th>
              <th scope="col" className="px-4 py-3 text-right">{COLUMNAS.cantidad}</th>
              <th scope="col" className="px-4 py-3 text-right">{COLUMNAS.cierre}</th>
              <th scope="col" className="px-4 py-3">{COLUMNAS.inversionista}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-hielo/10 even:bg-hielo/[0.04]">
                <td className="px-4 py-3 whitespace-nowrap">{f.fecha}</td>
                <td className="px-4 py-3">{f.ejecutivo}</td>
                <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{f.cantidad}</td>
                <td className="px-4 py-3 text-right">{f.cierre}</td>
                <td className="px-4 py-3">{f.inversionista}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-hielo/30 bg-marino-alto">
              <th scope="row" colSpan={2} className="px-4 py-3 text-left">{ETIQUETA_TOTAL}</th>
              <td className="px-4 py-3 text-right text-lg font-extrabold whitespace-nowrap text-verde-texto">{total}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        <ul aria-label={titulo} className="flex flex-col gap-3">
          {filas.map((f) => (
            <li key={f.id} className="superficie rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-bold">{f.inversionista}</p>
                <p className="text-lg font-extrabold whitespace-nowrap">{f.cantidad}</p>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-hielo">
                <dt className="font-semibold">{COLUMNAS.fecha}</dt>
                <dd>{f.fecha}</dd>
                <dt className="font-semibold">{COLUMNAS.ejecutivo}</dt>
                <dd>{f.ejecutivo}</dd>
                <dt className="font-semibold">{COLUMNAS.cierre}</dt>
                <dd>{f.cierre}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <p className="flex items-baseline justify-between rounded-2xl bg-marino-alto px-4 py-3 font-bold">
          {ETIQUETA_TOTAL}
          <span className="text-lg font-extrabold text-verde-texto">{total}</span>
        </p>
      </div>
    </>
  );
}
