import Link from "next/link";
import type { Conteo } from "../../../aplicacion/pipeline/filtros";
import { estatusEnPantalla, ESTATUS, type Estatus } from "../../../aplicacion/pipeline/normalizar";
import { FONDO_ESTATUS, type EstatusPipeline } from "../../../componentes/ui/InsigniaEstatus";
import { TEXTOS } from "./textosPantalla";

/**
 * Lo vistoso de la pantalla: una franja proporcional con los tres colores del
 * Excel y, debajo, el conteo de cada estatus. Cada conteo es un enlace que
 * filtra la lista (o quita el filtro si ya está puesto).
 */
export function BarraEstatus({
  conteo,
  activo,
  hrefDe,
}: {
  readonly conteo: Conteo;
  readonly activo: Estatus | null;
  readonly hrefDe: (estatus: Estatus | null) => string;
}) {
  return (
    <section aria-labelledby="titulo-estatus" className="superficie flex flex-col gap-5 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="titulo-estatus" className="text-lg font-bold text-hielo">
          {TEXTOS.tituloEstatus}
        </h2>
        <p className="text-hielo-tenue">
          <span className="text-3xl font-extrabold tracking-tight text-blanco tabular-nums">{conteo.total}</span>{" "}
          {conteo.total === 1 ? "activo" : "activos"}
        </p>
      </div>

      {/* Franja proporcional: solo dibuja; las cifras están en los enlaces de abajo. */}
      <div aria-hidden="true" className="flex h-4 w-full gap-1 overflow-hidden rounded-full bg-hielo/10">
        {ESTATUS.filter((e) => conteo[e] > 0).map((e) => (
          <span
            key={e}
            style={{ flexGrow: conteo[e] }}
            className={`h-full basis-0 transition-opacity duration-200 ${FONDO_ESTATUS[estatusEnPantalla(e) as EstatusPipeline]} ${
              activo !== null && activo !== e ? "opacity-30" : ""
            }`}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-3">
        {ESTATUS.map((e) => {
          const texto = estatusEnPantalla(e);
          const elegido = activo === e;
          return (
            <li key={e}>
              <Link
                href={hrefDe(elegido ? null : e)}
                aria-current={elegido ? "true" : undefined}
                aria-label={elegido ? TEXTOS.quitarFiltroEstatus(texto, conteo[e]) : TEXTOS.filtrarPor(texto, conteo[e])}
                className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 py-1.5 transition-colors duration-150 sm:min-h-16 sm:gap-4 sm:px-4 sm:py-3 ${
                  elegido ? "border-hielo bg-hielo/10" : "border-transparent hover:bg-hielo/5"
                } ${activo !== null && !elegido ? "opacity-60" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid min-w-12 place-items-center rounded-lg px-2 py-1 text-xl sm:min-w-14 sm:py-1.5 sm:text-2xl font-extrabold text-marino tabular-nums ${FONDO_ESTATUS[texto as EstatusPipeline]}`}
                >
                  {conteo[e]}
                </span>
                <span aria-hidden="true" className="font-bold tracking-wide text-blanco">
                  {texto}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
