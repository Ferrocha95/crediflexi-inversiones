import type { LucideIcon } from "lucide-react";

export type Tono = "positivo" | "atencion" | "alerta" | "neutro";

const TONOS: Record<Tono, string> = {
  positivo: "border-verde-texto/50 bg-verde-texto/12 text-blanco [--tono:var(--color-verde-texto)]",
  atencion: "border-amarillo/60 bg-amarillo/12 text-blanco [--tono:var(--color-amarillo)]",
  alerta: "border-error-texto/60 bg-error-texto/12 text-blanco [--tono:var(--color-error-texto)]",
  neutro: "border-hielo/35 bg-hielo/8 text-blanco [--tono:var(--color-hielo)]",
};

export interface PropsInsigniaTono {
  readonly etiqueta: string;
  readonly tono: Tono;
  readonly Icono?: LucideIcon;
}

/**
 * Insignia genérica. La etiqueta y el tono llegan de fuera: este componente no
 * define estados ni decide cuándo algo "está por vencer". El texto siempre va
 * en blanco; el color solo acompaña (borde, fondo tenue e ícono).
 */
export function InsigniaTono({ etiqueta, tono, Icono }: PropsInsigniaTono) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${TONOS[tono]}`}>
      {Icono !== undefined ? (
        <Icono aria-hidden="true" className="size-3.5 text-(--tono)" />
      ) : (
        <span aria-hidden="true" className="size-2 rounded-full bg-(--tono)" />
      )}
      {etiqueta}
    </span>
  );
}
