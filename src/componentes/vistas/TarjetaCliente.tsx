import { CalendarClock, Phone } from "lucide-react";
import { InsigniaTono, type Tono } from "../ui/InsigniaTono";

/** Un cliente con su inversión, ya formateado. Solo datos básicos: nada de RFC, CURP, cuentas ni documentos. */
export interface DatosCliente {
  readonly id: string;
  readonly nombre: string;
  readonly telefono: string;
  readonly monto: string;
  /** Fecha de vencimiento ya formateada, por ejemplo "15/12/2026". */
  readonly vencimiento: string;
  /** Estado de la inversión: etiqueta y tono llegan de fuera (no hay catálogo de estados aquí). */
  readonly estado: { readonly etiqueta: string; readonly tono: Tono };
  /** Días para vencer: `fraccion` (0 a 1, lo que queda del plazo) solo dibuja la barra; `texto` es lo que se lee. */
  readonly dias: { readonly fraccion: number; readonly texto: string };
}

const BARRA: Record<Tono, string> = {
  positivo: "bg-verde-texto",
  atencion: "bg-amarillo",
  alerta: "bg-error-texto",
  neutro: "bg-hielo",
};

/** Tarjeta de cliente con su inversión. No calcula: muestra lo que recibe. */
export function TarjetaCliente({ cliente }: { readonly cliente: DatosCliente }) {
  const f = Math.min(1, Math.max(0, cliente.dias.fraccion));
  return (
    <article className="superficie elevable flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-bold">{cliente.nombre}</h3>
        <InsigniaTono etiqueta={cliente.estado.etiqueta} tono={cliente.estado.tono} />
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{cliente.monto}</p>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-hielo">
        <dt>
          <Phone aria-hidden="true" className="size-4" />
          <span className="sr-only">Teléfono</span>
        </dt>
        <dd>{cliente.telefono}</dd>
        <dt>
          <CalendarClock aria-hidden="true" className="size-4" />
          <span className="sr-only">Vence</span>
        </dt>
        <dd>Vence el {cliente.vencimiento}</dd>
      </dl>
      <div className="flex flex-col gap-1.5">
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-hielo/12">
          <div className={`h-full rounded-full ${BARRA[cliente.estado.tono]}`} style={{ width: `${f * 100}%` }} />
        </div>
        <p className="text-sm font-semibold">{cliente.dias.texto}</p>
      </div>
    </article>
  );
}
