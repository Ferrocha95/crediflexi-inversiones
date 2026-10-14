"use client";

import { Download, Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { ModeloReclutamiento } from "../../../../aplicacion/reclutamiento";
import type { TextosReclutamiento } from "../../../../aplicacion/textos";
import type { RespuestaReclutamiento } from "../../../../servidor/reclutamiento";
import { AvisoSesionExpirada } from "../../../../componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada, vistaPreviaSinSesion } from "../../../../componentes/acceso/sesionExpirada";
import { Aviso } from "../../../../componentes/ui/Aviso";
import { Boton } from "../../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../../componentes/ui/Campo";
import { Opciones } from "../../../../componentes/ui/Opciones";
import { clasificarRespuestaPdf, mensajeDeErrorPdf } from "../../cotizador/peticionPdf";
import { TEXTOS } from "../textosPantalla";
import { simularReclutamiento } from "./acciones";

/** Pausa antes de recalcular, para no calcular con cada tecla. */
const PAUSA_MS = 400;
const RE_NOMBRE = /filename="([^"]+)"/;

interface Campos {
  /** "Interno" (ejecutivo) o "Externo". */
  readonly perfil: "interno" | "externo";
  readonly presenta: string;
  /** "¿Cuánto captarías al mes?", tal como se escribe. */
  readonly monto: string;
  /** Plazo de la cifra grande; null = el de los textos. */
  readonly plazo: number | null;
  /** Personalizar: monto por plazo, tal como se escribe. */
  readonly mezcla: Readonly<Record<string, string>>;
  /** Tal como se escribe; el servidor valida que sea un entero de 1 a 20. */
  readonly inversionesPorPlazo: string;
}

/** Lo que se manda al servidor: inversiones por plazo como número (0 si no es un entero: el servidor lo rechaza). */
const paraServidor = (c: Campos) => ({
  perfil: c.perfil,
  presenta: c.presenta,
  monto: c.monto,
  ...(c.plazo === null ? {} : { plazo: c.plazo }),
  mezcla: c.mezcla,
  inversionesPorPlazo: /^\d{1,3}$/.test(c.inversionesPorPlazo.trim()) ? Number(c.inversionesPorPlazo.trim()) : 0,
});

/** Solo los dígitos y el punto: "$1,000,000.00" y "1000000" son el mismo monto de ejemplo. */
const mismoMonto = (escrito: string, valor: string) => escrito.replace(/[$,\s]/g, "").replace(/\.0{1,2}$/, "") === valor;

export interface PropsReclutamiento {
  readonly textos: TextosReclutamiento;
  readonly plazos: readonly number[];
  /** Montos de un toque: el valor sin comas y su etiqueta ("$1,000,000"). */
  readonly montosEjemplo: readonly { readonly valor: string; readonly etiqueta: string; readonly escrito: string }[];
  readonly inicial: Campos;
  /** Calculado en el servidor con los campos iniciales; null si no se pudo. */
  readonly modeloInicial: ModeloReclutamiento | null;
}

type Mensaje = { readonly tipo: "estado" | "error"; readonly texto: string };

/** "Captación a {meses} meses" (la plantilla viene del archivo de textos). */
const conMeses = (plantilla: string, meses: number) => plantilla.replace("{meses}", String(meses));

/**
 * Modo reclutamiento: un solo dato visible y lo demás en "Personalizar". Lo
 * escrito vive solo en el estado de React: no se guarda en el navegador, en
 * cookies, en la URL ni en logs.
 */
export function Reclutamiento({ textos: t, plazos, montosEjemplo, inicial, modeloInicial }: PropsReclutamiento) {
  const id = useId();
  const [campos, setCampos] = useState<Campos>(inicial);
  const [version, setVersion] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaReclutamiento | null>(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [mensajePdf, setMensajePdf] = useState<Mensaje | null>(null);

  function cambiar(cambio: Partial<Campos>) {
    setCampos((c) => ({ ...c, ...cambio }));
    setVersion((v) => v + 1);
    setMensajePdf(null);
  }

  useEffect(() => {
    if (version === 0) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      let r: RespuestaReclutamiento;
      try {
        r = await simularReclutamiento({ ...paraServidor(campos), peticion: version });
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
        body: JSON.stringify(paraServidor(campos)),
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

  const interno = campos.perfil === "interno";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{interno ? t.tituloPaginaInterno : t.tituloPagina}</h1>
        {m !== null && m.frases.length > 0 && <p className="text-2xl font-bold text-verde-texto">{m.frases[0]}</p>}
        <p className="max-w-prose text-lg text-hielo">{interno ? t.introduccionInterno : t.introduccion}</p>
        {/* Solo para quien presenta: no salen en el PDF. */}
        {[m?.avisoFrasesRh ?? null, m?.avisoTextoInternoRh ?? null].map(
          (aviso) =>
            aviso !== null && (
              <p key={aviso} className="inline-flex items-center gap-1.5 self-start rounded-full border border-hielo/30 px-3 py-1 text-sm text-hielo-tenue">
                <Info aria-hidden="true" className="size-4" />
                {aviso}
              </p>
            ),
        )}
      </header>

      {sesionExpirada && <AvisoSesionExpirada siguiente="/comisiones/reclutamiento" />}

      {/* El dato visible: la captación del mes, con montos de un toque; arriba, el perfil. */}
      <form className="superficie flex flex-col gap-3 rounded-2xl p-5 sm:p-6" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <Opciones
          nombre={`${id}-perfil`}
          leyenda={t.perfil}
          valor={campos.perfil}
          alCambiar={(perfil) => cambiar({ perfil })}
          opciones={[
            { valor: "interno", etiqueta: t.perfilInterno },
            { valor: "externo", etiqueta: t.perfilExterno },
          ]}
        />
        <Campo id={`${id}-monto`} etiqueta={<span className="text-xl font-bold text-blanco">{t.preguntaMonto}</span>} ayuda={t.ayudaMonto}>
          <Entrada
            id={`${id}-monto`}
            inputMode="decimal"
            spellCheck={false}
            className="text-2xl font-bold tabular-nums"
            aria-describedby={`${id}-monto-ayuda`}
            value={campos.monto}
            onChange={(e) => cambiar({ monto: e.target.value })}
          />
        </Campo>
        <div className="flex flex-wrap gap-2">
          {montosEjemplo.map((x) => {
            const activo = mismoMonto(campos.monto, x.valor);
            return (
              <button
                key={x.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => cambiar({ monto: x.escrito })}
                className={`min-h-11 rounded-full border px-4 font-semibold tabular-nums transition-colors duration-150 ${
                  activo ? "border-verde-texto bg-verde-texto text-marino" : "border-hielo/35 text-hielo hover:border-hielo hover:text-blanco"
                }`}
              >
                {x.etiqueta}
              </button>
            );
          })}
        </div>
      </form>

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
          {/* Resultado grande, en lenguaje simple. */}
          <section aria-labelledby={`${id}-resultado`} className="superficie flex flex-col gap-1 rounded-2xl border-l-4 border-verde-texto p-5 sm:p-6">
            <h2 id={`${id}-resultado`} className="text-lg font-semibold text-hielo">
              {m.tituloCifra}
            </h2>
            <p data-testid="cifra-grande" className="text-5xl font-extrabold tracking-tight text-verde-texto tabular-nums">
              {m.cifra.total}
            </p>
            <p className="text-lg">{m.cifra.detalle}</p>
            {m.mezcla !== null && (
              <ul className="mt-1 flex flex-col gap-1 text-sm text-hielo">
                {m.mezcla.map((l) => (
                  <li key={l.plazo} className="break-words">
                    {l.plazo}: {l.operacion}
                  </li>
                ))}
              </ul>
            )}
            {/* Interno: el desglose del total y el desbloqueo de la meta. */}
            {m.interno !== null && (
              <>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {[
                    [m.interno.rotuloSueldoBase, m.interno.sueldoBase],
                    [t.comisionInterno, m.interno.comision],
                    [t.bonoInterno, m.interno.bono],
                  ].map(([etiqueta, valor]) => (
                    <div key={etiqueta} className="flex justify-between gap-3 sm:flex-col sm:justify-start">
                      <dt className="text-sm text-hielo">{etiqueta}</dt>
                      <dd className="font-bold tabular-nums">{valor}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm break-words text-hielo-tenue">
                  {t.calculo}: {m.interno.operacion}
                </p>
                <p className="mt-1 font-semibold">{m.interno.estadoDesbloqueo}</p>
                <p className="text-sm text-hielo">{m.interno.notaDesbloqueo}</p>
              </>
            )}
          </section>

          {/* Comparativo por plazos: cada barra es un botón que cambia la cifra grande. */}
          <section aria-labelledby={`${id}-plazos`} className="flex flex-col gap-3">
            <div>
              <h2 id={`${id}-plazos`} className="text-xl font-bold">
                {t.tituloComparativo}
              </h2>
              <p className="text-sm text-hielo-tenue">{t.ayudaComparativo}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {m.comparativo.map((p) => (
                <li key={p.plazo}>
                  <button
                    type="button"
                    aria-pressed={p.elegido}
                    onClick={() => cambiar({ plazo: p.plazo })}
                    className={`flex w-full min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors duration-150 ${
                      p.elegido ? "border-verde-texto bg-verde-texto/10" : "border-hielo/20 hover:border-hielo/50"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{p.etiqueta}</span>
                      <span className="text-lg font-extrabold tabular-nums">
                        {p.comision}
                        {p.bloqueada && <span className="ml-1.5 text-sm font-semibold text-hielo">({t.comparativoBloqueada})</span>}
                      </span>
                    </span>
                    {/* La cifra va en texto: la barra no depende del color. */}
                    <span aria-hidden="true" className="h-3 w-full rounded-full bg-hielo/15">
                      <span
                        className={`block h-full rounded-full ${p.elegido ? "bg-verde-texto" : "bg-verde-texto/50"}`}
                        style={{ width: `${p.fraccion * 100}%` }}
                      />
                    </span>
                    <span className="break-words text-sm text-hielo">{p.linea}</span>
                  </button>
                </li>
              ))}
            </ul>
            {m.fraseVeces !== null && <p className="text-lg font-bold">{m.fraseVeces}</p>}
          </section>

          {/* Interno: tabla de bonos con rangos y la fila alcanzada. */}
          {m.interno !== null && (
            <section aria-labelledby={`${id}-bonos-interno`} className="flex flex-col gap-3">
              <h2 id={`${id}-bonos-interno`} className="text-xl font-bold">
                {t.tituloBonosInterno}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-hielo">
                    <tr className="border-b border-hielo/20">
                      <th scope="col" className="py-2 pr-3">{t.columnaCumplimiento}</th>
                      <th scope="col" className="py-2 pr-3 text-right">{t.columnaDesde}</th>
                      <th scope="col" className="py-2 pr-3 text-right">{t.columnaHasta}</th>
                      <th scope="col" className="py-2 text-right">{t.columnaBono}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.interno.bonos.map((b) => (
                      <tr
                        key={b.desde}
                        aria-current={b.actual ? "true" : undefined}
                        className={`border-b border-hielo/10 ${b.actual ? "bg-verde-texto/10 font-bold" : ""}`}
                      >
                        <th scope="row" className="py-2 pr-3 font-semibold">
                          {b.cumplimiento}
                          {b.actual && <span className="block text-xs text-verde-texto">{t.escalonActual}</span>}
                        </th>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.desde}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.hasta}</td>
                        <td className="py-2 text-right tabular-nums">{b.bono}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Externo: escalera de bonos, con la captación de arriba marcada. El aviso de incorporación va solo aquí. */}
          {m.escalera.length > 0 && (
            <section aria-labelledby={`${id}-bonos`} className="flex flex-col gap-3">
              <h2 id={`${id}-bonos`} className="text-xl font-bold">
                {t.tituloBonos}
              </h2>
              <ol className="flex flex-col gap-2">
                {m.escalera.map((x, i) => (
                  <li
                    key={x.texto}
                    aria-current={x.actual ? "true" : undefined}
                    className={`rounded-xl border p-3 ${x.actual ? "border-2 border-verde-texto bg-verde-texto/10 font-bold" : "border-hielo/20 text-hielo"}`}
                    style={{ marginInlineStart: `${i * 0.75}rem` }}
                  >
                    {x.actual && <span className="mb-0.5 block text-sm text-verde-texto">{t.escalonActual}</span>}
                    {x.texto}
                  </li>
                ))}
              </ol>
              {m.avisoIncorporacion !== null && <p className="text-hielo">{m.avisoIncorporacion}</p>}
            </section>
          )}
        </>
      )}

      {/* Lo demás, colapsado. <details> se abre con Enter o Espacio sin código extra. */}
      <details className="superficie rounded-2xl p-5 sm:p-6">
        <summary className="min-h-11 cursor-pointer content-center text-lg font-bold">{t.personalizar}</summary>
        <div className="mt-4 flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="font-bold">{t.tituloMezcla}</legend>
            <p className="text-sm text-hielo-tenue">{t.ayudaMezcla}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {plazos.map((p) => (
                <Campo key={p} id={`${id}-mezcla-${p}`} etiqueta={conMeses(t.montoPlazo, p)}>
                  <Entrada
                    id={`${id}-mezcla-${p}`}
                    inputMode="decimal"
                    spellCheck={false}
                    className="tabular-nums"
                    value={campos.mezcla[String(p)] ?? ""}
                    onChange={(e) => cambiar({ mezcla: { ...campos.mezcla, [String(p)]: e.target.value } })}
                  />
                </Campo>
              ))}
            </div>
          </fieldset>

          <Campo id={`${id}-inversiones`} etiqueta={t.inversionesPorPlazo} ayuda={t.ayudaInversionesPorPlazo}>
            <Entrada
              id={`${id}-inversiones`}
              inputMode="numeric"
              maxLength={2}
              className="max-w-24 tabular-nums"
              aria-describedby={`${id}-inversiones-ayuda`}
              value={campos.inversionesPorPlazo}
              onChange={(e) => cambiar({ inversionesPorPlazo: e.target.value })}
            />
          </Campo>

          <Campo id={`${id}-presenta`} etiqueta={t.presenta} ayuda={t.ayudaPresenta}>
            <Entrada
              id={`${id}-presenta`}
              maxLength={60}
              aria-describedby={`${id}-presenta-ayuda`}
              value={campos.presenta}
              onChange={(e) => cambiar({ presenta: e.target.value })}
            />
          </Campo>
        </div>
      </details>

      {m !== null && (
        <>
          {/* Avisos fijos y visibles, igual que en el PDF. */}
          <div className="flex flex-col gap-2 rounded-xl border-2 border-hielo/60 bg-marino-alto/60 p-4 font-semibold">
            <p>{m.avisoInversiones}</p>
            <p>{m.aviso}</p>
            <p>{m.avisoTasas}</p>
          </div>

          {m.fechas !== null && (
            <section aria-labelledby={`${id}-fechas`} className="flex flex-col gap-1 text-sm">
              <h2 id={`${id}-fechas`} className="font-bold">
                {t.tituloFechas}
              </h2>
              {m.fechas.map((f) => (
                <p key={f} className="text-hielo">
                  {f}
                </p>
              ))}
            </section>
          )}

          <div className="flex flex-col gap-2">
            <Boton className="self-start" icono={<Download aria-hidden="true" className="size-5" />} cargando={generando} onClick={descargarPdf}>
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
    </div>
  );
}
