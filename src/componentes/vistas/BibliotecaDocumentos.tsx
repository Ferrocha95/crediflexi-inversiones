"use client";

import {
  BotonesDocumento,
  Categoria,
  IconoTipo,
  InsigniaNivel,
  InsigniaVigencia,
  TarjetaDocumento,
  type AccionesDocumento,
  type DatosDocumento,
} from "./TarjetaDocumento";

export type VistaBiblioteca = "galeria" | "lista";

export interface PropsBibliotecaDocumentos extends AccionesDocumento {
  readonly titulo: string;
  readonly documentos: readonly DatosDocumento[];
  readonly vista: VistaBiblioteca;
}

/** Biblioteca en galería (tarjetas) o en lista (tabla desde 768 px; filas compactas en el celular). */
export function BibliotecaDocumentos({ titulo, documentos, vista, alVer, alDescargar }: PropsBibliotecaDocumentos) {
  if (vista === "galeria") {
    return (
      <ul aria-label={titulo} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {documentos.map((d) => (
          <li key={d.id} className="flex">
            <div className="flex-1">
              <TarjetaDocumento documento={d} alVer={alVer} alDescargar={alDescargar} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-hielo/15 md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead className="bg-marino-alto text-hielo">
            <tr>
              <th scope="col" className="px-4 py-3">Documento</th>
              <th scope="col" className="px-4 py-3">Categoría</th>
              <th scope="col" className="px-4 py-3">Nivel</th>
              <th scope="col" className="px-4 py-3">Vigencia</th>
              <th scope="col" className="px-4 py-3">Versión</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((d) => (
              <tr key={d.id} className="border-t border-hielo/10">
                <th scope="row" className="px-4 py-2.5 font-bold">
                  <span className="flex items-center gap-3">
                    <IconoTipo tipo={d.tipo} />
                    {d.nombre}
                  </span>
                </th>
                <td className="px-4 py-2.5"><Categoria texto={d.categoria} /></td>
                <td className="px-4 py-2.5"><InsigniaNivel nivel={d.nivel} /></td>
                <td className="px-4 py-2.5"><InsigniaVigencia vigencia={d.vigencia} /></td>
                <td className="px-4 py-2.5 text-hielo">{d.version}</td>
                <td className="px-4 py-2.5"><BotonesDocumento documento={d} alVer={alVer} alDescargar={alDescargar} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={titulo} className="flex flex-col divide-y divide-hielo/10 rounded-2xl border border-hielo/15 md:hidden">
        {documentos.map((d) => (
          <li key={d.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <IconoTipo tipo={d.tipo} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="font-bold break-words">{d.nombre}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Categoria texto={d.categoria} />
                  <InsigniaNivel nivel={d.nivel} />
                  <InsigniaVigencia vigencia={d.vigencia} />
                  <span className="text-sm text-hielo-tenue">{d.version}</span>
                </div>
              </div>
            </div>
            <BotonesDocumento documento={d} alVer={alVer} alDescargar={alDescargar} />
          </li>
        ))}
      </ul>
    </>
  );
}
