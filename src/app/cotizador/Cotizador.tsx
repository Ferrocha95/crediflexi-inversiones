"use client";

import { useEffect, useId, useReducer, useState } from "react";
import type { ModeloVistaPrevia } from "../../aplicacion/modelo";
import type { OpcionesCotizador } from "../../aplicacion/opciones";
import type { Esquema, Moneda } from "../../domain/tasas/semilla.esquema";
import type { RespuestaVistaPrevia } from "../../servidor/vistaPrevia";
import { previsualizar } from "./acciones";
import {
  estadoInicial,
  huellaDeCampos,
  motivoPdfDeshabilitado,
  puedeGenerarPdf,
  reducirConfirmacion,
  vistaPreviaVigente,
} from "./confirmacion";
import {
  contarCaracteres,
  cuerpoPeticionPdf,
  mensajeDeErrorPdf,
  nombreDeArchivo,
  recortar,
  type OpcionalesPdf,
} from "./peticionPdf";
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

function camposIniciales(opciones: OpcionesCotizador): Campos {
  return {
    entidad: opciones.entidades[0]?.clave ?? "",
    moneda: (opciones.monedas.find((m) => m.habilitada) ?? opciones.monedas[0])?.moneda ?? "MXN",
    esquema: opciones.esquemas[0]?.esquema ?? "mensual",
    monto: "",
    plazo: null,
  };
}

const OPCIONALES_VACIOS: OpcionalesPdf = { preparadoPara: "", ejecutivo: "", vigencia: "", notaAdicional: "" };

/** Los campos opcionales del PDF, en el orden de la pantalla. */
const CAMPOS_OPCIONALES = ["preparadoPara", "ejecutivo", "vigencia", "notaAdicional"] as const;

type MensajePdf = { readonly tipo: "estado" | "error"; readonly texto: string };

const clasesCampo =
  "w-full rounded-md border border-black/25 bg-transparent px-3 py-2 text-base dark:border-white/30 disabled:opacity-50";

/**
 * Formulario del cotizador. Lo escrito vive solo en el estado de React: no se
 * guarda en el almacenamiento del navegador, en cookies, en la URL ni en logs.
 */
export function Cotizador({ opciones }: { opciones: OpcionesCotizador }) {
  const id = useId();
  const [campos, setCampos] = useState<Campos>(() => camposIniciales(opciones));
  /** Sube con cada cambio de campos: es el número de petición de la vista previa. */
  const [version, setVersion] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaVistaPrevia | null>(null);
  const [confirmacion, despachar] = useReducer(reducirConfirmacion<ModeloVistaPrevia>, opciones, (o) =>
    estadoInicial<ModeloVistaPrevia>(huellaDeCampos(camposIniciales(o))),
  );
  /** Solo se imprimen en el PDF: cambiarlos no invalida la confirmación de los números. */
  const [opcionales, setOpcionales] = useState<OpcionalesPdf>(OPCIONALES_VACIOS);
  const [generando, setGenerando] = useState(false);
  const [mensajePdf, setMensajePdf] = useState<MensajePdf | null>(null);

  function cambiar(cambio: Partial<Campos>) {
    const nuevos = { ...campos, ...cambio };
    setCampos(nuevos);
    setVersion((v) => v + 1);
    // Cualquier cambio en los campos invalida la vista previa y la confirmación.
    despachar({ tipo: "campoCambiado", huella: huellaDeCampos(nuevos) });
    setMensajePdf(null);
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
      despachar({
        tipo: "vistaPreviaRecibida",
        huella: huellaDeCampos(campos),
        vistaPrevia: r.resultado.tipo === "vista_previa" ? r.resultado.vistaPrevia : null,
      });
      // El plazo elegido dejó de estar disponible para este monto: se borra (y eso cuenta como cambio).
      if (campos.plazo !== null && r.plazos !== null && !r.plazos.some((p) => p.valor === campos.plazo)) {
        const sinPlazo = { ...campos, plazo: null };
        setCampos(sinPlazo);
        setVersion((v) => v + 1);
        despachar({ tipo: "campoCambiado", huella: huellaDeCampos(sinPlazo) });
        setMensajePdf(null);
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
  const puedePdf = puedeGenerarPdf(confirmacion);
  const motivoPdf = motivoPdfDeshabilitado(confirmacion);
  const motivosMoneda = opciones.monedas.filter((m) => !m.habilitada && m.motivo !== null);

  /** POST a /cotizador/pdf; el servidor recalcula todo y responde el archivo o un error en español. */
  async function generarPdf() {
    const vista = confirmacion.vistaPrevia;
    if (!puedePdf || generando || vista === null || campos.plazo === null) return;
    setGenerando(true);
    setMensajePdf({ tipo: "estado", texto: TEXTOS.generandoPdf });
    try {
      const r = await fetch("/cotizador/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(cuerpoPeticionPdf({ ...campos, plazo: campos.plazo }, opcionales, vista.tasas.version)),
      });
      if (!r.ok) {
        const cuerpo: unknown = await r.json().catch(() => undefined);
        setMensajePdf({ tipo: "error", texto: mensajeDeErrorPdf(r.status, cuerpo) });
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreDeArchivo(r.headers.get("content-disposition"));
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMensajePdf({ tipo: "estado", texto: TEXTOS.pdfListo });
    } catch {
      setMensajePdf({ tipo: "error", texto: TEXTOS.errorConexion });
    } finally {
      setGenerando(false);
    }
  }

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

        <fieldset className="mt-2 flex flex-col gap-3 border-t border-black/15 pt-4 dark:border-white/20">
          <legend className="font-semibold">{TEXTOS.tituloOpcionales}</legend>
          <p className="text-sm opacity-70">{TEXTOS.ayudaOpcionales}</p>
          {CAMPOS_OPCIONALES.map((clave) => {
            const tope = opciones.topes[clave];
            const valor = opcionales[clave];
            const props = {
              id: `${id}-${clave}`,
              className: clasesCampo,
              value: valor,
              autoComplete: "off",
              "aria-describedby": `${id}-${clave}-contador`,
              onChange: (e: { target: { value: string } }) =>
                setOpcionales((o) => ({ ...o, [clave]: recortar(e.target.value, tope) })),
            };
            return (
              <div key={clave} className="flex flex-col gap-1">
                <label htmlFor={props.id} className="font-medium">
                  {TEXTOS[clave]}
                </label>
                {clave === "notaAdicional" ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
                <p id={props["aria-describedby"]} className="text-right text-xs opacity-70">
                  {TEXTOS.contador(contarCaracteres(valor), tope)}
                </p>
              </div>
            );
          })}
        </fieldset>
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

        <div className="mt-2 flex flex-col gap-3 border-t border-black/15 pt-4 dark:border-white/20">
          <h3 className="font-semibold">{TEXTOS.tituloConfirmacion}</h3>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={confirmacion.confirmado}
              disabled={!vistaPreviaVigente(confirmacion)}
              onChange={(e) => despachar({ tipo: e.target.checked ? "confirmar" : "desconfirmar" })}
            />
            <span>{TEXTOS.confirmo}</span>
          </label>
          <button
            type="button"
            className="w-full rounded-md bg-foreground px-4 py-2 font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:self-start"
            disabled={!puedePdf || generando}
            aria-describedby={motivoPdf === null ? undefined : `${id}-motivo-pdf`}
            onClick={generarPdf}
          >
            {TEXTOS.generarPdf}
          </button>
          {motivoPdf !== null && (
            <p id={`${id}-motivo-pdf`} className="text-sm opacity-80">
              {motivoPdf}
            </p>
          )}
          <p role="status" className="text-sm">
            {mensajePdf?.tipo === "estado" ? mensajePdf.texto : null}
          </p>
          {mensajePdf?.tipo === "error" && (
            <div role="alert" className="rounded-md border-2 border-red-600 p-3">
              <p className="font-semibold">{TEXTOS.tituloErrorPdf}</p>
              <p className="mt-1 text-sm">{mensajePdf.texto}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
