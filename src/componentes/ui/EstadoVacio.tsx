import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export interface PropsEstadoVacio {
  readonly titulo: ReactNode;
  readonly descripcion?: ReactNode;
  readonly icono?: ReactNode;
  /** Botón o enlace con lo que se puede hacer para llenar el espacio. */
  readonly accion?: ReactNode;
}

/** Espacio sin datos: dice qué falta y ofrece la acción para llenarlo. */
export function EstadoVacio({ titulo, descripcion, icono, accion }: PropsEstadoVacio) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-hielo/30 p-6">
      <span className="grid size-12 place-items-center rounded-xl bg-hielo/10 text-hielo">
        {icono ?? <Inbox aria-hidden="true" className="size-6" />}
      </span>
      <p className="text-lg font-bold text-blanco">{titulo}</p>
      {descripcion !== undefined && <p className="max-w-prose text-hielo">{descripcion}</p>}
      {accion}
    </div>
  );
}
