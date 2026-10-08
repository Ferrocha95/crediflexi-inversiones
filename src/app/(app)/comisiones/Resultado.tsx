"use client";

import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import type { ModeloComisiones } from "../../../aplicacion/comisiones";
import { InsigniaTono } from "../../../componentes/ui/InsigniaTono";
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

/** Resultado del simulador: muestra el modelo tal como llega del servidor; aquí no se calcula nada. */
export function Resultado({ modelo: m }: { modelo: ModeloComisiones }) {
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
          <Cifra etiqueta={TEXTOS.comisionBloqueada} valor={m.totales.comisionBloqueada} />
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

      {/* Bono de externos: aparte de la comisión; su fecha de pago no está definida y no se muestra. */}
      {m.perfil === "externo" && m.bono !== null && (
        <section aria-labelledby="titulo-bono-externo" className="flex flex-col gap-3">
          <h3 id="titulo-bono-externo" className="text-lg font-bold">
            {TEXTOS.tituloBonoExterno}
          </h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Cifra etiqueta={TEXTOS.tituloBonoExterno} valor={m.bono} fuerte />
          </dl>
          <p className="text-sm text-hielo-tenue">{TEXTOS.ayudaBonoExterno}</p>
        </section>
      )}

      {m.perfil === "interno" && (
        <section aria-labelledby="titulo-incentivos" className="flex flex-col gap-3">
          <h3 id="titulo-incentivos" className="text-lg font-bold">
            {TEXTOS.tituloIncentivos}
          </h3>
          {m.sueldoBase !== null || m.bono !== null ? (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {m.sueldoBase !== null && <Cifra etiqueta={TEXTOS.sueldoBase} valor={m.sueldoBase} />}
              {m.bono !== null && <Cifra etiqueta={TEXTOS.bono} valor={m.bono} />}
            </dl>
          ) : null}
          {m.bono === null && <p className="text-hielo">{TEXTOS.sinBono}</p>}
          <p className="text-sm text-hielo-tenue">{TEXTOS.fechaIncentivosPorConfirmar}</p>
        </section>
      )}

      <p className="text-sm text-hielo-tenue">{TEXTOS.simulador}</p>
    </div>
  );
}
