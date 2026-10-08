"use client";

import { Download } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { ModeloReclutamiento } from "../../../../aplicacion/reclutamiento";
import type { TextosReclutamiento } from "../../../../aplicacion/textos";
import type { RespuestaReclutamiento } from "../../../../servidor/reclutamiento";
import { AvisoSesionExpirada } from "../../../../componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada, vistaPreviaSinSesion } from "../../../../componentes/acceso/sesionExpirada";
import { Aviso } from "../../../../componentes/ui/Aviso";
import { Boton } from "../../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../../componentes/ui/Campo";
import { clasificarRespuestaPdf, mensajeDeErrorPdf } from "../../cotizador/peticionPdf";
import { TEXTOS } from "../textosPantalla";
import { simularReclutamiento } from "./acciones";

/** Pausa antes de recalcular, para no calcular con cada tecla. */
const PAUSA_MS = 400;
const RE_NOMBRE = /filename="([^"]+)"/;

interface Escenario {
  readonly nombre: string;
  readonly montos: Readonly<Record<string, string>>;
}

interface Campos {
  readonly presenta: string;
  readonly escenarios: readonly Escenario[];
}

export interface PropsReclutamiento {
  readonly textos: TextosReclutamiento;
  readonly plazos: readonly number[];
  readonly inicial: Campos;
  /** Calculado en el servidor con los campos iniciales; null si no se pudo. */
  readonly modeloInicial: ModeloReclutamiento | null;
}

type Mensaje = { readonly tipo: "estado" | "error"; readonly texto: string };

/** "Captación a {meses} meses" (la plantilla viene del archivo de textos). */
const conMeses = (plantilla: string, meses: number) => plantilla.replace("{meses}", String(meses));

/**
 * Modo reclutamiento. Lo escrito vive solo en el estado de React: no se guarda
 * en el navegador, en cookies, en la URL ni en logs.
 */
export function Reclutamiento({ textos: t, plazos, inicial, modeloInicial }: PropsReclutamiento) {
  const id = useId();
  const [campos, setCampos] = useState<Campos>(inicial);
  const [version, setVersion] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaReclutamiento | null>(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [mensajePdf, setMensajePdf] = useState<Mensaje | null>(null);

  function cambiar(nuevos: Campos) {
    setCampos(nuevos);
    setVersion((v) => v + 1);
    setMensajePdf(null);
  }

  function cambiarEscenario(i: number, cambio: Partial<Escenario>) {
    cambiar({ ...campos, escenarios: campos.escenarios.map((e, j) => (j === i ? { ...e, ...cambio } : e)) });
  }

  useEffect(() => {
    if (version === 0) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      let r: RespuestaReclutamiento;
      try {
        r = await simularReclutamiento({ ...campos, peticion: version });
      } catch (e) {
        if (errorEsSesionExpirada(e)) setSesionExpirada(true);
        r = { peticion: version, resultado: { tipo: "error", mensaje: TEXTOS.errorConexion, detalles: [] } };
      }
      if (vistaPreviaSinSesion(r.resultado)) setSesionExpirada(true);
      if (!vigente || r.peticion !== version) return;
      setRespuesta(r);
    }, PAUSA_MS);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [campos, version]);

  // Sin cambios todavía: el modelo calculado en el servidor.
  const actual: RespuestaReclutamiento["resultado"] | null =
    version === 0
      ? modeloInicial === null
        ? null
        : { tipo: "modelo", modelo: modeloInicial }
      : respuesta !== null && respuesta.peticion === version
        ? respuesta.resultado
        : null;
  const m = actual?.tipo === "modelo" ? actual.modelo : null;

  /** POST al PDF: el servidor recalcula todo y responde el archivo o un error en español. */
  async function descargarPdf() {
    if (m === null || generando) return;
    setGenerando(true);
    setMensajePdf({ tipo: "estado", texto: TEXTOS.generandoPdf });
    try {
      const r = await fetch("/comisiones/reclutamiento/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(campos),
      });
      const clase = clasificarRespuestaPdf(r.status, r.headers.get("content-type"));
      if (clase === "sesion_expirada") {
        setSesionExpirada(true);
        setMensajePdf(null);
        return;
      }
      if (clase !== "pdf") {
        const cuerpo: unknown = clase === "error" ? await r.json().catch(() => undefined) : undefined;
        setMensajePdf({ tipo: "error", texto: mensajeDeErrorPdf(r.status, cuerpo) });
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = RE_NOMBRE.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? TEXTOS.nombrePdfPorOmision;
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
    <div className="flex flex-col gap-6">
      <Aviso tono="info" titulo={t.revisionInterna} />
      {sesionExpirada && <AvisoSesionExpirada siguiente="/comisiones/reclutamiento" />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:gap-8">
        <form
          className="superficie flex flex-col gap-5 rounded-2xl p-5 sm:p-6"
          autoComplete="off"
          onSubmit={(e) => e.preventDefault()}
          aria-labelledby={`${id}-titulo`}
        >
          <h2 id={`${id}-titulo`} className="text-2xl font-bold">
            {t.tituloEscenarios}
          </h2>
          <p className="-mt-3 text-sm text-hielo-tenue">{t.ayudaEscenarios}</p>

          <Campo id={`${id}-presenta`} etiqueta={t.presenta} ayuda={t.ayudaPresenta}>
            <Entrada
              id={`${id}-presenta`}
              maxLength={80}
              aria-describedby={`${id}-presenta-ayuda`}
              value={campos.presenta}
              onChange={(e) => cambiar({ ...campos, presenta: e.target.value })}
            />
          </Campo>

          {campos.escenarios.map((e, i) => (
            <fieldset key={i} className="flex flex-col gap-3 rounded-xl border border-hielo/20 p-4">
              <legend className="px-1 font-bold">{e.nombre.trim() === "" ? `#${i + 1}` : e.nombre}</legend>
              <Campo id={`${id}-nombre-${i}`} etiqueta={t.nombreEscenario}>
                <Entrada
                  id={`${id}-nombre-${i}`}
                  maxLength={40}
                  value={e.nombre}
                  onChange={(ev) => cambiarEscenario(i, { nombre: ev.target.value })}
                />
              </Campo>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {plazos.map((p) => (
                  <Campo key={p} id={`${id}-monto-${i}-${p}`} etiqueta={conMeses(t.montoPlazo, p)}>
                    <Entrada
                      id={`${id}-monto-${i}-${p}`}
                      inputMode="decimal"
                      spellCheck={false}
                      className="tabular-nums"
                      value={e.montos[String(p)] ?? ""}
                      onChange={(ev) => cambiarEscenario(i, { montos: { ...e.montos, [String(p)]: ev.target.value } })}
                    />
                  </Campo>
                ))}
              </div>
            </fieldset>
          ))}
        </form>

        <section aria-labelledby={`${id}-resultado`} className="flex flex-col gap-5">
          <h2 id={`${id}-resultado`} className="text-2xl font-bold">
            {t.tituloResultado}
          </h2>

          {actual === null ? (
            <p className="text-hielo" aria-busy="true">
              {TEXTOS.calculando}
            </p>
          ) : actual.tipo === "error" ? (
            <Aviso role="alert" tono="error" titulo={TEXTOS.tituloErrorReclutamiento}>
              <p>{actual.mensaje}</p>
            </Aviso>
          ) : null}

          {m !== null && (
            <>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {m.escenarios.map((e, i) => (
                  <li key={i} className="superficie flex flex-col gap-2 rounded-2xl p-5">
                    <h3 className="font-bold">{e.nombre}</h3>
                    <p className="text-sm text-hielo">{t.comisionTotal}</p>
                    <p className="text-3xl font-extrabold text-verde-texto tabular-nums">{e.total}</p>
                    <p className="mt-1 text-sm font-semibold text-hielo">{t.desglosePorPlazo}</p>
                    {e.lineas.length === 0 ? (
                      <p className="text-sm text-hielo-tenue">{t.sinCaptacion}</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {e.lineas.map((l) => (
                          <li key={l.plazo}>
                            <span className="font-semibold">
                              {l.plazo}: {l.comision}
                            </span>
                            <span className="block text-hielo-tenue break-words">{l.operacion}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              <section aria-labelledby={`${id}-grafica`} className="flex flex-col gap-3">
                <h3 id={`${id}-grafica`} className="text-lg font-bold">
                  {t.tituloGrafica}
                </h3>
                {/* Cada barra lleva su nombre y su cifra en texto: no depende del color. */}
                <ul className="flex flex-col gap-2">
                  {m.grafica.map((b, i) => (
                    <li key={i} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-3">
                      <span className="truncate text-sm">{b.nombre}</span>
                      <span aria-hidden="true" className="h-3 rounded-full bg-hielo/15">
                        <span className="block h-full rounded-full bg-verde-texto" style={{ width: `${b.fraccion * 100}%` }} />
                      </span>
                      <span className="font-bold tabular-nums">{b.total}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby={`${id}-fechas`} className="flex flex-col gap-2">
                <h3 id={`${id}-fechas`} className="text-lg font-bold">
                  {t.tituloFechas}
                </h3>
                {m.fechas.map((f) => (
                  <p key={f} className="text-hielo">
                    {f}
                  </p>
                ))}
              </section>

              {/* Aviso fijo y visible, igual que en el PDF. */}
              <p className="rounded-xl border-2 border-hielo/60 bg-marino-alto/60 p-4 font-semibold">{m.aviso}</p>

              <div className="flex flex-col gap-2">
                <Boton
                  className="self-start"
                  icono={<Download aria-hidden="true" className="size-5" />}
                  cargando={generando}
                  onClick={descargarPdf}
                >
                  {t.descargarPdf}
                </Boton>
                {mensajePdf !== null &&
                  (mensajePdf.tipo === "error" ? (
                    <Aviso role="alert" tono="error" titulo={TEXTOS.tituloErrorPdf}>
                      <p>{mensajePdf.texto}</p>
                    </Aviso>
                  ) : (
                    <p role="status" className="text-hielo">
                      {mensajePdf.texto}
                    </p>
                  ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
