import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

export const PROXIMAMENTE = "Próximamente";

export interface PropsTarjetaResumen {
  readonly titulo: string;
  readonly Icono: LucideIcon;
  /** Qué módulo la activa, por ejemplo "Se activa con el módulo de Metas." */
  readonly modulo: string;
  /** true: "Próximamente" y el esqueleto quieto; nada de datos. */
  readonly proximamente: boolean;
  /** Silueta del contenido, sin datos (va con aria-hidden). */
  readonly esqueleto: ReactNode;
  /** El contenido con datos; solo se muestra si no es "Próximamente". */
  readonly children?: ReactNode;
  readonly className?: string;
}

/** Marco de las tarjetas de resumen del inicio. Opaca: no suma capas de desenfoque. */
export function TarjetaResumen({ titulo, Icono, modulo, proximamente, esqueleto, children, className = "" }: PropsTarjetaResumen) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-titulo`} className={`superficie flex flex-col gap-4 rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-hielo/10 text-hielo">
          <Icono aria-hidden="true" className="size-5" />
        </span>
        <h3 id={`${id}-titulo`} className="flex-1 text-lg font-bold">
          {titulo}
        </h3>
      </div>
      {proximamente ? (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-hielo-tenue">
            <span className="rounded-full bg-hielo/10 px-2.5 py-1 text-xs font-semibold text-hielo">{PROXIMAMENTE}</span>
            {modulo}
          </p>
          <div aria-hidden="true">{esqueleto}</div>
        </>
      ) : (
        children
      )}
    </section>
  );
}
