"use client";

import { useEffect, useId, useState } from "react";
import type { OpcionesCotizador } from "../../aplicacion/opciones";
import type { Esquema, Moneda } from "../../domain/tasas/semilla.esquema";
import type { RespuestaVistaPrevia } from "../../servidor/vistaPrevia";
import { previsualizar } from "./acciones";
import { TEXTOS } from "./textosPantalla";
import { VistaPrevia } from "./VistaPrevia";

/** Pausa antes de pedir la vista previa, para no calcular con cada tecla. */
const PAUSA_MS = 400;

interface Campos {
  readonly entidad: string;
  readonly moneda: Moneda;
  readonly esquema: Esquema;
  readonly monto: string;
  readonly plazo: number | null;
}

const clasesCampo =
  "w-full rounded-md border border-black/25 bg-transparent px-3 py-2 text-base dark:border-white/30 disabled:opacity-50";

/**
 * Formulario del cotizador. Lo escrito vive solo en el estado de React: no se
 * guarda en el almacenamiento del navegador, en cookies, en la URL ni en logs.
 */
export function Cotizador({ opciones }: { opciones: OpcionesCotizador }) {
  const id = useId();
  const [campos, setCampos] = useState<Campos>(() => ({
    entidad: opciones.entidades[0]?.clave ?? "",
    moneda: (opciones.monedas.find((m) => m.habilitada) ?? opciones.monedas[0])?.moneda ?? "MXN",
    esquema: opciones.esquemas[0]?.esquema ?? "mensual",
    monto: "",
    plazo: null,
  }));
  /** Sube con cada cambio de campos: es el número de petición de la vista previa. */
  const [version, setVersion] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaVistaPrevia | null>(null);

  function cambiar(cambio: Partial<Campos>) {
    setCampos((c) => ({ ...c, ...cambio }));
    setVersion((v) => v + 1);
  }

  const hayMonto = campos.monto.trim() !== "";

  useEffect(() => {
    if (!hayMonto) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      let r: RespuestaVistaPrevia;
      try {
        r = await previsualizar({ ...campos, peticion: version });
      } catch {
        r = { peticion: version, plazos: null, resultado: { tipo: "error", mensaje: TEXTOS.errorConexion, detalles: [] } };
      }
      // Si los campos cambiaron mientras tanto, la respuesta es vieja y se descarta.
      if (!vigente || r.peticion !== version) return;
      setRespuesta(r);
      if (campos.plazo !== null && r.plazos !== null && !r.plazos.some((p) => p.valor === campos.plazo)) {
        cambiar({ plazo: null });
      }
    }, PAUSA_MS);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [campos, version, hayMonto]);

  const actual = hayMonto && respuesta !== null && respuesta.peticion === version ? respuesta : null;
  const plazos = hayMonto ? (respuesta?.plazos ?? []) : [];
  const monedaElegida = opciones.monedas.find((m) => m.moneda === campos.moneda);
  const motivosMoneda = opciones.monedas.filter((m) => !m.habilitada && m.motivo !== null);

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <form
        className="flex flex-col gap-4"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
        aria-labelledby={`${id}-titulo-formulario`}
      >
        <h2 id={`${id}-titulo-formulario`} className="text-lg font-semibold">
          {TEXTOS.tituloFormulario}
        </h2>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-entidad`} className="font-medium">
            {TEXTOS.entidad}
          </label>
          <select
            id={`${id}-entidad`}
            className={clasesCampo}
            value={campos.entidad}
            onChange={(e) => cambiar({ entidad: e.target.value })}
          >
            {opciones.entidades.map((e) => (
              <option key={e.clave} value={e.clave}>
                {e.razonSocial}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-moneda`} className="font-medium">
            {TEXTOS.moneda}
          </label>
          <select
            id={`${id}-moneda`}
            className={clasesCampo}
            value={campos.moneda}
            aria-describedby={motivosMoneda.length > 0 ? `${id}-motivo-moneda` : undefined}
            onChange={(e) => {
              const m = opciones.monedas.find((x) => x.moneda === e.target.value);
              if (m?.habilitada) cambiar({ moneda: m.moneda });
            }}
          >
            {opciones.monedas.map((m) => (
              <option key={m.moneda} value={m.moneda} disabled={!m.habilitada}>
                {m.moneda}
              </option>
            ))}
          </select>
          {motivosMoneda.length > 0 && (
            <ul id={`${id}-motivo-moneda`} className="text-sm opacity-80">
              {motivosMoneda.map((m) => (
                <li key={m.moneda}>{m.motivo}</li>
              ))}
            </ul>
          )}
          {monedaElegida !== undefined && !monedaElegida.habilitada && monedaElegida.motivo !== null && (
            <p className="text-sm">{monedaElegida.motivo}</p>
          )}
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="font-medium">{TEXTOS.esquema}</legend>
          {opciones.esquemas.map((e) => (
            <label key={e.esquema} className="flex items-center gap-2 py-1">
              <input
                type="radio"
                name={`${id}-esquema`}
                value={e.esquema}
                checked={campos.esquema === e.esquema}
                onChange={() => cambiar({ esquema: e.esquema })}
                className="size-4"
              />
              {e.nombre}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-monto`} className="font-medium">
            {TEXTOS.monto}
          </label>
          <input
            id={`${id}-monto`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className={`${clasesCampo} font-mono`}
            value={campos.monto}
            aria-describedby={`${id}-ayuda-monto`}
            onChange={(e) => cambiar({ monto: e.target.value })}
          />
          <p id={`${id}-ayuda-monto`} className="text-sm opacity-70">
            {TEXTOS.ayudaMonto}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-plazo`} className="font-medium">
            {TEXTOS.plazo}
          </label>
          <select
            id={`${id}-plazo`}
            className={clasesCampo}
            value={campos.plazo === null ? "" : String(campos.plazo)}
            disabled={plazos.length === 0}
            onChange={(e) => cambiar({ plazo: e.target.value === "" ? null : Number(e.target.value) })}
          >
            <option value="">{hayMonto ? TEXTOS.eligePlazoOpcion : TEXTOS.plazoSinMonto}</option>
            {plazos.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </form>

      <section aria-labelledby={`${id}-titulo-vista`} className="flex flex-col gap-3">
        <h2 id={`${id}-titulo-vista`} className="text-lg font-semibold">
          {TEXTOS.tituloVistaPrevia}
        </h2>
        <div aria-live="polite" aria-busy={hayMonto && actual === null}>
          {!hayMonto ? (
            <p>{TEXTOS.escribeMonto}</p>
          ) : actual === null ? (
            <p>{TEXTOS.calculando}</p>
          ) : actual.resultado.tipo === "error" ? (
            <div className="rounded-md border-2 border-red-600 p-4">
              <p className="font-semibold">{TEXTOS.tituloError}</p>
              <p className="mt-1">{actual.resultado.mensaje}</p>
              {actual.resultado.detalles.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {actual.resultado.detalles.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : actual.resultado.tipo === "elige_plazo" ? (
            <p>{TEXTOS.eligePlazo}</p>
          ) : (
            <VistaPrevia vista={actual.resultado.vistaPrevia} />
          )}
        </div>
      </section>
    </div>
  );
}
