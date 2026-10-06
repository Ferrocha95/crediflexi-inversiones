"use client";

import { useEffect, useId, useReducer, useState } from "react";
import type { ModeloVistaPrevia } from "../../../aplicacion/modelo";
import type { OpcionesCotizador } from "../../../aplicacion/opciones";
import type { Esquema, Moneda } from "../../../domain/tasas/semilla.esquema";
import type { RespuestaVistaPrevia } from "../../../servidor/vistaPrevia";
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
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { AreaTexto, Campo, Entrada } from "../../../componentes/ui/Campo";
import { Casilla } from "../../../componentes/ui/Casilla";
import { Esqueleto } from "../../../componentes/ui/Esqueleto";
import { Opciones } from "../../../componentes/ui/Opciones";
import { Selector } from "../../../componentes/ui/Selector";
import { TarjetaVidrio } from "../../../componentes/ui/TarjetaVidrio";
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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8">
      <form
        className="superficie flex flex-col gap-5 rounded-2xl p-5 sm:p-6"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
        aria-labelledby={`${id}-titulo-formulario`}
      >
        <h2 id={`${id}-titulo-formulario`} className="text-2xl font-bold">
          {TEXTOS.tituloFormulario}
        </h2>

        <Campo id={`${id}-entidad`} etiqueta={TEXTOS.entidad}>
          <Selector id={`${id}-entidad`} value={campos.entidad} onChange={(e) => cambiar({ entidad: e.target.value })}>
            {opciones.entidades.map((e) => (
              <option key={e.clave} value={e.clave}>
                {e.razonSocial}
              </option>
            ))}
          </Selector>
        </Campo>

        <div className="flex flex-col gap-1.5">
          <Campo id={`${id}-moneda`} etiqueta={TEXTOS.moneda}>
            <Selector
              id={`${id}-moneda`}
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
            </Selector>
          </Campo>
          {motivosMoneda.length > 0 && (
            <ul id={`${id}-motivo-moneda`} className="text-sm text-hielo-tenue">
              {motivosMoneda.map((m) => (
                <li key={m.moneda}>{m.motivo}</li>
              ))}
            </ul>
          )}
          {monedaElegida !== undefined && !monedaElegida.habilitada && monedaElegida.motivo !== null && (
            <p className="text-sm text-hielo">{monedaElegida.motivo}</p>
          )}
        </div>

        <Opciones
          nombre={`${id}-esquema`}
          leyenda={TEXTOS.esquema}
          valor={campos.esquema}
          alCambiar={(esquema) => cambiar({ esquema })}
          opciones={opciones.esquemas.map((e) => ({ valor: e.esquema, etiqueta: e.nombre }))}
        />

        <Campo id={`${id}-monto`} etiqueta={TEXTOS.monto} ayuda={TEXTOS.ayudaMonto}>
          <Entrada
            id={`${id}-monto`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            className="text-lg font-bold tabular-nums"
            value={campos.monto}
            aria-describedby={`${id}-monto-ayuda`}
            onChange={(e) => cambiar({ monto: e.target.value })}
          />
        </Campo>

        <Campo id={`${id}-plazo`} etiqueta={TEXTOS.plazo}>
          <Selector
            id={`${id}-plazo`}
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
          </Selector>
        </Campo>

        <fieldset className="mt-1 flex flex-col gap-4 border-t border-hielo/15 pt-5">
          <legend className="float-left mb-1 w-full text-lg font-bold">{TEXTOS.tituloOpcionales}</legend>
          <p className="text-sm text-hielo-tenue">{TEXTOS.ayudaOpcionales}</p>
          {CAMPOS_OPCIONALES.map((clave) => {
            const tope = opciones.topes[clave];
            const valor = opcionales[clave];
            const props = {
              id: `${id}-${clave}`,
              value: valor,
              autoComplete: "off",
              "aria-describedby": `${id}-${clave}-contador`,
              onChange: (e: { target: { value: string } }) =>
                setOpcionales((o) => ({ ...o, [clave]: recortar(e.target.value, tope) })),
            };
            return (
              <Campo
                key={clave}
                id={props.id}
                etiqueta={TEXTOS[clave]}
                contador={TEXTOS.contador(contarCaracteres(valor), tope)}
              >
                {clave === "notaAdicional" ? <AreaTexto rows={3} {...props} /> : <Entrada type="text" {...props} />}
              </Campo>
            );
          })}
        </fieldset>
      </form>

      <TarjetaVidrio
        como="section"
        aria-labelledby={`${id}-titulo-vista`}
        className="flex flex-col gap-5 lg:sticky lg:top-6"
      >
        <h2 id={`${id}-titulo-vista`} className="text-2xl font-bold">
          {TEXTOS.tituloVistaPrevia}
        </h2>
        <div aria-live="polite" aria-busy={hayMonto && actual === null}>
          {!hayMonto ? (
            <p className="text-hielo">{TEXTOS.escribeMonto}</p>
          ) : actual === null ? (
            <div className="flex flex-col gap-3">
              <p className="text-hielo">{TEXTOS.calculando}</p>
              <Esqueleto className="h-5 w-1/3" />
              <Esqueleto className="h-14 w-2/3" />
              <Esqueleto className="h-4 w-full" />
            </div>
          ) : actual.resultado.tipo === "error" ? (
            <Aviso tono="error" titulo={TEXTOS.tituloError}>
              <p>{actual.resultado.mensaje}</p>
              {actual.resultado.detalles.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {actual.resultado.detalles.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </Aviso>
          ) : actual.resultado.tipo === "elige_plazo" ? (
            <p className="text-hielo">{TEXTOS.eligePlazo}</p>
          ) : (
            <VistaPrevia vista={actual.resultado.vistaPrevia} />
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-hielo/15 pt-5">
          <h3 className="text-lg font-bold">{TEXTOS.tituloConfirmacion}</h3>
          <Casilla
            etiqueta={TEXTOS.confirmo}
            checked={confirmacion.confirmado}
            disabled={!vistaPreviaVigente(confirmacion)}
            onChange={(e) => despachar({ tipo: e.target.checked ? "confirmar" : "desconfirmar" })}
          />
          <Boton
            className="w-full sm:w-auto sm:self-start"
            disabled={!puedePdf}
            cargando={generando}
            aria-describedby={motivoPdf === null ? undefined : `${id}-motivo-pdf`}
            onClick={generarPdf}
          >
            {TEXTOS.generarPdf}
          </Boton>
          {motivoPdf !== null && (
            <p id={`${id}-motivo-pdf`} className="text-sm text-hielo">
              {motivoPdf}
            </p>
          )}
          <p role="status" className="text-sm text-hielo">
            {mensajePdf?.tipo === "estado" ? mensajePdf.texto : null}
          </p>
          {mensajePdf?.tipo === "error" && (
            <Aviso role="alert" tono="error" titulo={TEXTOS.tituloErrorPdf}>
              <p className="text-sm">{mensajePdf.texto}</p>
            </Aviso>
          )}
        </div>
      </TarjetaVidrio>
    </div>
  );
}
