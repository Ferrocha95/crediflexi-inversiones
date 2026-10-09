"use client";

import type { ModeloVistaPrevia } from "../../../aplicacion/modelo";
import { Aviso } from "../../../componentes/ui/Aviso";
import { TEXTOS } from "./textosPantalla";

/**
 * Muestra la vista previa tal como llega del servidor: aquí no se calcula nada.
 * Desde el Sprint 6a no muestra importes ni tablas de rendimientos: solo los
 * datos capturados, la tasa aplicada con su desglose, el tramo y los avisos.
 */
export function VistaPrevia({ vista }: { vista: ModeloVistaPrevia }) {
  return (
    <div className="flex flex-col gap-6">
      {vista.tasaAcordadaAlta !== null && (
        <Aviso tono="advertencia" titulo={TEXTOS.tituloAvisos}>
          <p>{TEXTOS.avisoTasaAcordadaAlta(vista.tasaAcordadaAlta.tasa, vista.tasaAcordadaAlta.maximoTabla, vista.tasaAcordadaAlta.limite, vista.tasaAcordadaAlta.puntos)}</p>
        </Aviso>
      )}
      {vista.avisos.length > 0 && (
        <Aviso tono="advertencia" titulo={TEXTOS.tituloAvisos}>
          <ul className="list-disc pl-5">
            {vista.avisos.map((a) => (
              <li key={a.codigo}>{a.mensaje}</li>
            ))}
          </ul>
        </Aviso>
      )}

      {/* Sprint 6a: solo lo capturado y la tasa aplicada; los importes y las tablas van únicamente en el PDF. */}
      <section aria-labelledby="titulo-datos" className="flex flex-col gap-3">
        <h3 id="titulo-datos" className="text-lg font-bold">
          {TEXTOS.tituloDatos}
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.monto}</dt>
            <dd className="font-semibold tabular-nums">{vista.solicitud.monto}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-hielo-tenue">{vista.tramo === null ? TEXTOS.plazoEspecial : TEXTOS.plazo}</dt>
            <dd className="font-semibold">{vista.solicitud.plazo}</dd>
          </div>
          {vista.solicitud.fechaInicio !== null && (
            <div>
              <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.fechaInicio}</dt>
              <dd className="font-semibold tabular-nums">{vista.solicitud.fechaInicio}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.esquema}</dt>
            <dd className="font-semibold">{vista.solicitud.esquema}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-hielo-tenue">{vista.etiquetaTasa}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{vista.tasa}</dd>
            {vista.desgloseTasa !== null && (
              <dd className="mt-1 text-hielo">
                {TEXTOS.desglosePuntos(vista.desgloseTasa.tasaTabla, vista.desgloseTasa.puntos, vista.desgloseTasa.tasa)}
              </dd>
            )}
          </div>
          {vista.tramo !== null && (
            <>
              <div>
                <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.tramoAplicado}</dt>
                <dd className="font-semibold tabular-nums">{vista.tramo.rango}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.estatusTasa}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-hielo/40 px-3 py-0.5 text-sm font-semibold">
                    {vista.tramo.estatus ?? TEXTOS.sinEstatus}
                  </span>
                  {vista.tramo.explicacionEstatus !== null && <span className="text-hielo">{vista.tramo.explicacionEstatus}</span>}
                  {vista.origenTasa === "plazo_adicional" && <p className="w-full text-sm text-hielo">{TEXTOS.origenPlazoAdicional}</p>}
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <p className="text-sm text-hielo-tenue">{TEXTOS.versionTasas(vista.tasas.version, vista.tasas.fecha)}</p>
    </div>
  );
}
