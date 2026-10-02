"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export interface PropsDialogo {
  readonly abierto: boolean;
  readonly alCerrar: () => void;
  readonly titulo: ReactNode;
  readonly children: ReactNode;
  /** Botones del pie, por ejemplo Cancelar y la acción principal. */
  readonly acciones?: ReactNode;
  readonly etiquetaCerrar?: string;
}

/**
 * Diálogo modal con el <dialog> nativo: showModal() encierra el foco, Esc lo
 * cierra y el navegador devuelve el foco al control que lo abrió.
 */
export function Dialogo({ abierto, alCerrar, titulo, children, acciones, etiquetaCerrar = "Cerrar" }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (d === null) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titulo`}
      onClose={alCerrar}
      onClick={(e) => {
        // Un clic en el fondo (fuera de la caja) cierra el diálogo.
        if (e.target === e.currentTarget) alCerrar();
      }}
      className="dialogo m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 text-blanco"
    >
      <div className="vidrio flex flex-col gap-4 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-titulo`} className="text-2xl font-bold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label={etiquetaCerrar}
            className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-hielo hover:bg-hielo/10"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="text-hielo">{children}</div>
        {acciones !== undefined && <div className="flex flex-wrap justify-end gap-3">{acciones}</div>}
      </div>
    </dialog>
  );
}
