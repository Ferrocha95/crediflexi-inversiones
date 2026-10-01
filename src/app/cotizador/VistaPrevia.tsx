"use client";

import type { ModeloVistaPrevia } from "../../aplicacion/modelo";
import { TEXTOS } from "./textosPantalla";

/** Muestra la vista previa tal como llega del servidor: aquí no se calcula nada. */
export function VistaPrevia({ vista }: { vista: ModeloVistaPrevia }) {
  return (
    <div className="flex flex-col gap-5">
      {vista.avisos.length > 0 && (
        <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
          <p className="font-semibold">{TEXTOS.tituloAvisos}</p>
          <ul className="mt-1 list-disc pl-5">
            {vista.avisos.map((a) => (
              <li key={a.codigo}>{a.mensaje}</li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm opacity-70">{TEXTOS.tasaAnual}</dt>
          <dd className="font-mono text-2xl font-semibold">{vista.tasa}</dd>
        </div>
        <div>
          <dt className="text-sm opacity-70">{TEXTOS.tramoAplicado}</dt>
          <dd className="font-mono">{vista.tramo.rango}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm opacity-70">{TEXTOS.estatusTasa}</dt>
          <dd>
            <span className="rounded border border-current px-2 py-0.5 font-mono text-sm">
              {vista.tramo.estatus ?? TEXTOS.sinEstatus}
            </span>
            {vista.tramo.explicacionEstatus !== null && <span className="ml-2">{vista.tramo.explicacionEstatus}</span>}
            {vista.origenTasa === "plazo_adicional" && <p className="mt-1 text-sm">{TEXTOS.origenPlazoAdicional}</p>}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="titulo-cifras">
        <h3 id="titulo-cifras" className="mb-2 font-semibold">
          {TEXTOS.tituloCifras}
        </h3>
        <ul className="flex flex-col gap-3">
          {vista.salidas.map((s) => (
            <li key={s.clave} className="rounded-md border border-black/15 p-3 dark:border-white/20">
              <p className="text-sm">{s.etiqueta}</p>
              <p className="font-mono text-xl font-semibold">{s.cifra}</p>
              <dl className="mt-2 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="opacity-70">{TEXTOS.formula}:</dt>
                  <dd className="font-mono">{s.formula}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="opacity-70">{TEXTOS.operacion}:</dt>
                  <dd className="font-mono break-all">{s.operacion}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm opacity-70">{TEXTOS.versionTasas(vista.tasas.version, vista.tasas.fecha)}</p>
    </div>
  );
}
