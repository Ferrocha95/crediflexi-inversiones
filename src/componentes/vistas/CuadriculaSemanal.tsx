import { Pestanas } from "../ui/Pestanas";

/** Catálogo de "¿Dónde?" del plan semanal (docs/FORMATOS_EXCEL.md). */
export const LUGARES = ["Sucursal", "Campo", "Comida"] as const;
export type Lugar = (typeof LUGARES)[number];

/** Horas de la cuadrícula, como en el Excel: de 9:00 a 18:00. */
export const HORAS = ["9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"] as const;
export type Hora = (typeof HORAS)[number];

export interface Bloque {
  readonly donde?: Lugar;
  readonly que?: string;
}

export interface DiaPlan {
  readonly clave: string;
  /** "Lunes", "Martes"... */
  readonly nombre: string;
  /** Fecha ya formateada, por ejemplo "6/10/2026". */
  readonly fecha: string;
  readonly bloques: Partial<Record<Hora, Bloque>>;
}

const COLOR_LUGAR: Record<Lugar, string> = {
  Sucursal: "bg-hielo/15 text-blanco",
  Campo: "bg-verde-texto/15 text-blanco",
  Comida: "bg-amarillo/15 text-blanco",
};

function Lugar({ donde }: { readonly donde?: Lugar }) {
  if (donde === undefined) return null;
  return <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-semibold ${COLOR_LUGAR[donde]}`}>{donde}</span>;
}

const ENCABEZADO_DONDE = "¿Dónde?";
const ENCABEZADO_QUE = "Qué";
const ENCABEZADO_HORA = "Hora";

/** Un día en tres columnas (hora, dónde y qué), para el celular. */
function TablaDia({ dia }: { readonly dia: DiaPlan }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{`${dia.nombre} ${dia.fecha}`}</caption>
      <thead className="bg-marino-alto text-hielo">
        <tr>
          <th scope="col" className="px-3 py-2">{ENCABEZADO_HORA}</th>
          <th scope="col" className="px-3 py-2">{ENCABEZADO_DONDE}</th>
          <th scope="col" className="px-3 py-2">{ENCABEZADO_QUE}</th>
        </tr>
      </thead>
      <tbody>
        {HORAS.map((h) => {
          const b = dia.bloques[h];
          return (
            <tr key={h} className="border-t border-hielo/10">
              <th scope="row" className="px-3 py-2.5 font-semibold text-hielo">{h}</th>
              <td className="px-3 py-2.5"><Lugar donde={b?.donde} /></td>
              <td className="px-3 py-2.5">{b?.que}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Plan semanal: lunes a viernes, de 9:00 a 18:00, y por día "¿Dónde?" y "Qué".
 * Cuadrícula completa desde 1024 px; en pantallas menores, un día por pestaña.
 */
export function CuadriculaSemanal({ titulo, dias }: { readonly titulo: string; readonly dias: readonly DiaPlan[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-hielo/15 lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">{titulo}</caption>
          <colgroup>
            <col className="w-16" />
            {dias.map((d) => (
              <col key={d.clave} span={2} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-marino-logo text-blanco">
              <td className="px-3 py-2" />
              {dias.map((d) => (
                <th key={d.clave} scope="colgroup" colSpan={2} className="border-l border-hielo/15 px-3 py-2 text-base">
                  {d.nombre} <span className="font-semibold text-hielo">{d.fecha}</span>
                </th>
              ))}
            </tr>
            <tr className="bg-marino-alto text-hielo">
              <th scope="col" className="px-3 py-2">{ENCABEZADO_HORA}</th>
              {dias.map((d) => [
                <th key={`${d.clave}-donde`} scope="col" className="w-24 border-l border-hielo/15 px-3 py-2">{ENCABEZADO_DONDE}</th>,
                <th key={`${d.clave}-que`} scope="col" className="px-3 py-2">{ENCABEZADO_QUE}</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {HORAS.map((h) => (
              <tr key={h} className="border-t border-hielo/10 odd:bg-hielo/[0.03]">
                <th scope="row" className="px-3 py-2.5 font-semibold text-hielo">{h}</th>
                {dias.map((d) => {
                  const b = d.bloques[h];
                  return [
                    <td key={`${d.clave}-donde`} className="border-l border-hielo/15 px-3 py-2.5"><Lugar donde={b?.donde} /></td>,
                    <td key={`${d.clave}-que`} className="px-3 py-2.5 break-words">{b?.que}</td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lg:hidden">
        <Pestanas
          etiqueta={titulo}
          pestanas={dias.map((d) => ({
            clave: d.clave,
            etiqueta: d.nombre,
            contenido: (
              <div className="overflow-hidden rounded-2xl border border-hielo/15">
                <TablaDia dia={d} />
              </div>
            ),
          }))}
        />
      </div>
    </>
  );
}
