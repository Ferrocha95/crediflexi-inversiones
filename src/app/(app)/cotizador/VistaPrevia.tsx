"use client";

import type { ModeloVistaPrevia } from "../../../aplicacion/modelo";
import { Aviso } from "../../../componentes/ui/Aviso";
import { TarjetaCifra } from "../../../componentes/ui/TarjetaCifra";
import { TEXTOS } from "./textosPantalla";

/** Muestra la vista previa tal como llega del servidor: aquí no se calcula nada. */
export function VistaPrevia({ vista }: { vista: ModeloVistaPrevia }) {
  return (
    <div className="flex flex-col gap-6">
      {vista.tasaAcordadaAlta !== null && (
        <Aviso tono="advertencia" titulo={TEXTOS.tituloAvisos}>
          <p>{TEXTOS.avisoTasaAcordadaAlta(vista.tasaAcordadaAlta.tasa, vista.tasaAcordadaAlta.maximoTabla, vista.tasaAcordadaAlta.limite)}</p>
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

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.esquema}</dt>
          <dd className="font-semibold">{vista.solicitud.esquema}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-hielo-tenue">{vista.plazoEspecial ? TEXTOS.tasaAcordada : TEXTOS.tasaAnual}</dt>
          <dd className="text-2xl font-extrabold tabular-nums">{vista.tasa}</dd>
          {vista.desgloseTasa !== null && (
            <dd className="mt-1 text-hielo">
              {TEXTOS.desglosePuntos(vista.desgloseTasa.tasaTabla, vista.desgloseTasa.puntos, vista.desgloseTasa.tasa)}
            </dd>
          )}
        </div>
        {vista.tramo === null ? (
          <div>
            <dt className="text-sm font-semibold text-hielo-tenue">{TEXTOS.plazoEspecial}</dt>
            <dd className="font-semibold">{vista.solicitud.plazo}</dd>
          </div>
        ) : (
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

      <section aria-labelledby="titulo-cifras" className="flex flex-col gap-3">
        <h3 id="titulo-cifras" className="text-lg font-bold">
          {TEXTOS.tituloCifras}
        </h3>
        <p className="text-hielo">{vista.lineaPago}</p>
        <ul className="flex flex-col gap-4">
          {vista.salidas.map((s, i) => (
            <li key={s.clave} className={i === 0 ? "pb-1" : "border-t border-hielo/15 pt-4"}>
              <TarjetaCifra
                etiqueta={s.etiqueta}
                valor={s.cifra}
                tono={i === 0 ? "positivo" : "neutro"}
                tamano={i === 0 ? "grande" : "mediano"}
                flecha={i === 0}
              >
                <dl className="flex flex-col gap-1">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-hielo-tenue">{TEXTOS.formula}:</dt>
                    <dd>{s.formula}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-semibold text-hielo-tenue">{TEXTOS.operacion}:</dt>
                    <dd className="break-all tabular-nums">{s.operacion}</dd>
                  </div>
                </dl>
              </TarjetaCifra>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-hielo-tenue">{TEXTOS.versionTasas(vista.tasas.version, vista.tasas.fecha)}</p>
    </div>
  );
}
