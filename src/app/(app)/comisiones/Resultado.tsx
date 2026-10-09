"use client";

import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import type { ModeloComisiones } from "../../../aplicacion/comisiones";
import type { TextosComisiones } from "../../../aplicacion/textos";
import { InsigniaTono } from "../../../componentes/ui/InsigniaTono";
import { llenar } from "./plantilla";
import { TEXTOS } from "./textosPantalla";

/** "1, 2 y 3" (los números de inversión de un pago). */
function lista(ns: readonly number[]): string {
  return ns.length <= 1 ? ns.join("") : `${ns.slice(0, -1).join(", ")} y ${ns.at(-1)}`;
}

function Cifra({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-hielo/15 bg-marino/50 p-3">
      <dt className="text-sm font-semibold text-hielo">{etiqueta}</dt>
      <dd className={`tabular-nums ${fuerte ? "text-2xl font-extrabold" : "text-lg font-bold"}`}>{valor}</dd>
    </div>
  );
}

/** Barra de avance de la meta con marcas en el umbral de desbloqueo y en el 100%. */
function BarraAvance({ avance, captacion }: { avance: NonNullable<ModeloComisiones["avance"]>; captacion: string }) {
  const descripcion = TEXTOS.avanceDescripcion(avance.porcentaje, captacion, avance.meta);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={TEXTOS.tituloAvance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(avance.fraccion * 100)}
        aria-valuetext={descripcion}
        className="relative h-4 overflow-hidden rounded-full bg-hielo/15"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-suave ${avance.desbloqueada ? "bg-verde-texto" : "bg-amarillo"}`}
          style={{ width: `${avance.fraccion * 100}%` }}
        />
        <div aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-blanco" style={{ left: `${avance.fraccionUmbral * 100}%` }} />
      </div>
      <div aria-hidden="true" className="relative h-9 text-xs text-hielo sm:h-5">
        {/* La marca del umbral se rotula a su izquierda y la meta al extremo derecho: no se enciman. */}
        <span className="absolute -translate-x-full pr-1 whitespace-nowrap" style={{ left: `${avance.fraccionUmbral * 100}%` }}>
          {TEXTOS.marcaUmbral(avance.porcentajeUmbral)}
        </span>
        {/* En celular, la meta baja un renglón para no tocar el rótulo del umbral. */}
        <span className="absolute top-4 right-0 whitespace-nowrap sm:top-0">{TEXTOS.marcaMeta}</span>
      </div>
      <p className="font-semibold">{descripcion}</p>
    </div>
  );
}

/**
 * Tabla de incentivos (Cumplimiento, Desde, Hasta, Incentivo) con la fila
 * alcanzada resaltada. Tarjetas en celular y tabla desde tableta.
 */
function TablaIncentivos({ incentivos, textos: t }: { incentivos: NonNullable<ModeloComisiones["incentivos"]>; textos: TextosComisiones }) {
  const hasta = (h: string | null) => h ?? t.enAdelante;
  const incentivo = (bono: string) => llenar(t.incentivoMasComision, { bono });
  const alcanzada = <InsigniaTono etiqueta={t.filaAlcanzada} tono="positivo" />;
  return (
    <>
      {/* Celular: una tarjeta por fila. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {incentivos.filas.map((f) => (
          <li key={f.desde} className={`rounded-xl border p-3 ${f.alcanzada ? "border-verde-texto/60 bg-verde-texto/10" : "border-hielo/15 bg-marino/50"}`}>
            <p className="flex flex-wrap items-center justify-between gap-2 font-bold">
              {f.cumplimiento}
              {f.alcanzada && alcanzada}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-hielo">{t.columnaDesde}</dt>
              <dd className="text-right tabular-nums">{f.desde}</dd>
              <dt className="text-hielo">{t.columnaHasta}</dt>
              <dd className="text-right tabular-nums">{hasta(f.hasta)}</dd>
              <dt className="text-hielo">{t.columnaIncentivo}</dt>
              <dd className="text-right font-bold tabular-nums">{incentivo(f.bono)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      {/* Tableta y escritorio: tabla. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead className="text-hielo">
            <tr className="border-b border-hielo/20">
              <th scope="col" className="py-2 pr-3">{t.columnaCumplimiento}</th>
              <th scope="col" className="py-2 pr-3 text-right">{t.columnaDesde}</th>
              <th scope="col" className="py-2 pr-3 text-right">{t.columnaHasta}</th>
              <th scope="col" className="py-2 text-right">{t.columnaIncentivo}</th>
            </tr>
          </thead>
          <tbody>
            {incentivos.filas.map((f) => (
              <tr key={f.desde} className={`border-b border-hielo/10 align-top ${f.alcanzada ? "bg-verde-texto/10 font-semibold" : ""}`}>
                <th scope="row" className="py-2 pr-3 font-semibold">
                  <span className="flex flex-wrap items-center gap-2">
                    {f.cumplimiento}
                    {f.alcanzada && alcanzada}
                  </span>
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{f.desde}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{hasta(f.hasta)}</td>
                <td className="py-2 text-right font-bold tabular-nums">{incentivo(f.bono)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Resultado del simulador: muestra el modelo tal como llega del servidor; aquí no se calcula nada. */
export function Resultado({ modelo: m, textos: t }: { modelo: ModeloComisiones; textos: TextosComisiones }) {
  const etiquetaTipo = (t: "nueva" | "renovacion") => (t === "nueva" ? TEXTOS.nueva : TEXTOS.renovacion);
  const pago = (f: string | null) => f ?? TEXTOS.sinPago;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="titulo-totales" className="superficie flex flex-col gap-4 rounded-2xl p-5">
        <h3 id="titulo-totales" className="sr-only">
          {TEXTOS.comisionDelMes}
        </h3>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cifra etiqueta={TEXTOS.comisionDelMes} valor={m.totales.comisionBruta} />
          <Cifra etiqueta={TEXTOS.comisionPagable} valor={m.totales.comisionPagable} fuerte />
          {m.totales.comisionBloqueada !== null && <Cifra etiqueta={TEXTOS.comisionBloqueada} valor={m.totales.comisionBloqueada} />}
        </dl>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Cifra etiqueta={TEXTOS.captacionParaMeta} valor={m.totales.captacionParaMeta} />
        </dl>
      </section>

      {m.avance !== null && (
        <section aria-labelledby="titulo-avance" className="superficie flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="titulo-avance" className="text-lg font-bold">
              {TEXTOS.tituloAvance}
            </h3>
            {m.avance.desbloqueada ? (
              <InsigniaTono etiqueta={TEXTOS.desbloqueada} tono="positivo" Icono={LockKeyholeOpen} />
            ) : (
              <InsigniaTono etiqueta={TEXTOS.bloqueada} tono="atencion" Icono={LockKeyhole} />
            )}
          </div>
          <BarraAvance avance={m.avance} captacion={m.totales.captacionParaMeta} />
          <ul className="flex flex-col gap-1 text-hielo">
            {m.avance.fechaDesbloqueo !== null && <li>{TEXTOS.desbloqueadaEl(m.avance.fechaDesbloqueo)}</li>}
            {m.avance.faltaParaUmbral !== null && <li>{TEXTOS.faltaUmbral(m.avance.faltaParaUmbral, m.avance.umbral)}</li>}
            <li>{m.avance.faltaParaMeta === null ? TEXTOS.metaCumplida : TEXTOS.faltaMeta(m.avance.faltaParaMeta)}</li>
            {m.notaBloqueo !== null && <li>{TEXTOS.reglaCierre(m.notaBloqueo)}</li>}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-tabla" className="flex flex-col gap-3">
        <h3 id="titulo-tabla" className="text-lg font-bold">
          {TEXTOS.tituloTabla}
        </h3>
        {/* Celular: una tarjeta por inversión. */}
        <ul className="flex flex-col gap-3 sm:hidden">
          {m.lineas.map((l) => (
            <li key={l.numero} className="superficie rounded-xl p-4">
              <p className="font-bold">
                {TEXTOS.inversion(l.numero)} · {etiquetaTipo(l.tipo)}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-hielo">{TEXTOS.columnaMonto}</dt>
                <dd className="text-right tabular-nums">{l.monto}</dd>
                <dt className="text-hielo">{TEXTOS.columnaPlazo}</dt>
                <dd className="text-right">{l.plazo}</dd>
                <dt className="text-hielo">{TEXTOS.columnaTasa}</dt>
                <dd className="text-right tabular-nums">{l.tasa}</dd>
                <dt className="text-hielo">{TEXTOS.columnaComision}</dt>
                <dd className="text-right font-bold tabular-nums">{l.comision}</dd>
                <dt className="text-hielo">{TEXTOS.columnaPago}</dt>
                <dd className="text-right">{pago(l.fechaPago)}</dd>
              </dl>
              <p className="mt-2 text-sm break-words text-hielo-tenue">
                {TEXTOS.calculo}: {l.operacion}
              </p>
              {!l.cuentaParaMeta && <p className="mt-1 text-sm text-hielo-tenue">{TEXTOS.noCuentaParaMeta}</p>}
            </li>
          ))}
        </ul>
        {/* Tableta y escritorio: tabla. */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{TEXTOS.tituloTabla}</caption>
            <thead className="text-hielo">
              <tr className="border-b border-hielo/20">
                <th scope="col" className="py-2 pr-3">{TEXTOS.columnaNumero}</th>
                <th scope="col" className="py-2 pr-3">{TEXTOS.columnaTipo}</th>
                <th scope="col" className="py-2 pr-3 text-right">{TEXTOS.columnaMonto}</th>
                <th scope="col" className="py-2 pr-3">{TEXTOS.columnaPlazo}</th>
                <th scope="col" className="py-2 pr-3 text-right">{TEXTOS.columnaTasa}</th>
                <th scope="col" className="py-2 pr-3 text-right">{TEXTOS.columnaComision}</th>
                <th scope="col" className="py-2">{TEXTOS.columnaPago}</th>
              </tr>
            </thead>
            <tbody>
              {m.lineas.map((l) => (
                <tr key={l.numero} className="border-b border-hielo/10 align-top">
                  <th scope="row" className="py-2 pr-3 font-semibold">{l.numero}</th>
                  <td className="py-2 pr-3">
                    {etiquetaTipo(l.tipo)}
                    {!l.cuentaParaMeta && <span className="block text-xs text-hielo-tenue">{TEXTOS.noCuentaParaMeta}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.monto}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{l.plazo}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.tasa}</td>
                  <td className="py-2 pr-3 text-right font-bold tabular-nums">
                    {l.comision}
                    <span className="block text-xs font-normal text-hielo-tenue">{l.operacion}</span>
                  </td>
                  <td className="py-2 whitespace-nowrap">{pago(l.fechaPago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="titulo-calendario" className="flex flex-col gap-3">
        <h3 id="titulo-calendario" className="text-lg font-bold">
          {TEXTOS.tituloCalendario}
        </h3>
        <p className="text-sm text-hielo">{TEXTOS.reglaQuincenas(m.regla.ultimoDiaQuincena1, m.regla.diaPagoQuincena1, m.regla.diaPagoQuincena2)}</p>
        {m.perfil === "interno" && <p className="text-sm text-hielo">{TEXTOS.reglaInterno(m.regla.ultimoDiaQuincena1)}</p>}
        {m.pagos.length === 0 ? (
          <p className="font-semibold">{TEXTOS.sinPagos}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {m.pagos.map((p) => (
              <li key={p.fecha} className="superficie flex flex-wrap items-baseline justify-between gap-2 rounded-xl p-4">
                <span className="font-bold">{p.fecha}</span>
                <span className="text-sm text-hielo">
                  {p.inversiones.length === 1 ? TEXTOS.pagoDeUna(p.inversiones[0]) : TEXTOS.pagoDe(lista(p.inversiones))}
                </span>
                <span className="text-lg font-extrabold tabular-nums">{p.monto}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {m.bonoGerente !== null && (
        <section aria-labelledby="titulo-bono-gerente" className="superficie flex flex-col gap-3 rounded-2xl p-5">
          <h3 id="titulo-bono-gerente" className="text-lg font-bold">
            {TEXTOS.tituloBonoGerente}
          </h3>
          <p className="text-sm text-hielo">{TEXTOS.ayudaBonoGerente}</p>
          <ol className="flex flex-col gap-1 text-sm">
            {m.bonoGerente.lineas.map((l) => (
              <li key={l.numero} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {TEXTOS.inversionEquipo(l.numero)} · {etiquetaTipo(l.tipo)} · {l.monto} · {l.plazo} · {l.tasa}
                </span>
                <span className="font-semibold tabular-nums">{l.comision}</span>
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Cifra etiqueta={TEXTOS.baseBonoGerente} valor={m.bonoGerente.base} />
            <Cifra etiqueta={TEXTOS.bonoGerente} valor={m.bonoGerente.bono} fuerte />
          </dl>
          <p className="text-sm text-hielo-tenue">
            {TEXTOS.calculo}: {m.bonoGerente.operacion}
          </p>
        </section>
      )}

      {m.redExterna !== null && (
        <section aria-labelledby="titulo-red-externa" className="superficie flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="titulo-red-externa" className="text-lg font-bold">
              {llenar(t.comisionPorExternos, { porcentaje: m.redExterna.porcentaje })}
            </h3>
            <InsigniaTono etiqueta={t.supuestoPorConfirmar} tono="neutro" />
          </div>
          <ol className="flex flex-col gap-1 text-sm">
            {m.redExterna.lineas.map((l) => (
              <li key={l.numero} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {llenar(t.inversionExterno, { n: l.numero })} · {etiquetaTipo(l.tipo)} · {l.monto} · {l.plazo} · {l.tasa}
                </span>
                <span className="font-semibold tabular-nums">{l.comision}</span>
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Cifra etiqueta={t.basePorExternos} valor={m.redExterna.base} />
            <Cifra etiqueta={TEXTOS.comisionPagable} valor={m.redExterna.pagable} fuerte />
            <Cifra etiqueta={TEXTOS.comisionBloqueada} valor={m.redExterna.bloqueada} />
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            {m.redExterna.desbloqueada ? (
              <InsigniaTono etiqueta={TEXTOS.desbloqueada} tono="positivo" Icono={LockKeyholeOpen} />
            ) : (
              <InsigniaTono etiqueta={TEXTOS.bloqueada} tono="atencion" Icono={LockKeyhole} />
            )}
            <p className="text-sm text-hielo">
              {llenar(m.redExterna.desbloqueada ? t.redDesbloqueada : t.redBloqueada, { umbral: m.redExterna.umbral })}
            </p>
          </div>
          {m.redExterna.notaBloqueo !== null && <p className="text-sm text-hielo">{TEXTOS.reglaCierre(m.redExterna.notaBloqueo)}</p>}
          <p className="text-sm text-hielo-tenue">
            {TEXTOS.calculo}: {m.redExterna.operacion}
          </p>
          <p className="text-sm text-hielo-tenue">{t.notaAparte}</p>
        </section>
      )}

      {/* Externo: tabla de incentivos por captación nueva; su fecha de pago no está definida y no se muestra. */}
      {m.incentivos?.tipo === "externo" && (
        <section aria-labelledby="titulo-incentivos-externo" className="flex flex-col gap-3">
          <h3 id="titulo-incentivos-externo" className="text-lg font-bold">
            {t.tituloIncentivosExterno}
          </h3>
          <p className="text-sm text-hielo">{t.ayudaIncentivosExterno}</p>
          <TablaIncentivos incentivos={m.incentivos} textos={t} />
          {m.incentivos.metaReferencia !== null && (
            <p className="text-sm text-hielo-tenue">{llenar(t.notaMetaInterna, { meta: m.incentivos.metaReferencia })}</p>
          )}
        </section>
      )}

      {/* EJECUTIVO: tabla de metas, sueldo base (propuesta) y desde dónde se desbloquea. */}
      {m.incentivos?.tipo === "interno" && (
        <section aria-labelledby="titulo-metas" className="flex flex-col gap-3">
          <h3 id="titulo-metas" className="text-lg font-bold">
            {t.tituloMetas}
          </h3>
          <TablaIncentivos incentivos={m.incentivos} textos={t} />
          {m.sueldoBase !== null && (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Cifra etiqueta={t.sueldoBase} valor={m.sueldoBase} />
            </dl>
          )}
          {m.incentivos.desbloqueo !== null && (
            <p className="text-sm text-hielo">
              {llenar(t.notaDesbloqueo, { porcentaje: m.incentivos.desbloqueo.porcentaje, umbral: m.incentivos.desbloqueo.umbral })}
            </p>
          )}
          <p className="text-sm text-hielo-tenue">{TEXTOS.fechaIncentivosPorConfirmar}</p>
        </section>
      )}

      {/* GERENTE: sin tabla; su bono y su sueldo base siguen sin definir. */}
      {m.perfil === "interno" && m.incentivos === null && (
        <section aria-labelledby="titulo-incentivos" className="flex flex-col gap-3">
          <h3 id="titulo-incentivos" className="text-lg font-bold">
            {TEXTOS.tituloIncentivos}
          </h3>
          <p className="text-hielo">{TEXTOS.sinBono}</p>
          <p className="text-sm text-hielo-tenue">{TEXTOS.fechaIncentivosPorConfirmar}</p>
        </section>
      )}

      <p className="text-sm text-hielo-tenue">{TEXTOS.simulador}</p>
    </div>
  );
}
