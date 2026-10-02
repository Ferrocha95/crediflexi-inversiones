"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Tono = "exito" | "error" | "info";

export interface Notificacion {
  readonly tono: Tono;
  readonly titulo: string;
  readonly texto?: string;
}

interface Visible extends Notificacion {
  readonly id: number;
}

/** Las de éxito e información se van solas; los errores se quedan hasta que se cierran. */
const DURACION_MS = 6000;

const ICONOS: Record<Tono, typeof Info> = { exito: CircleCheck, error: CircleAlert, info: Info };
const COLOR_ICONO: Record<Tono, string> = { exito: "text-verde-texto", error: "text-error-texto", info: "text-hielo" };

const Contexto = createContext<((n: Notificacion) => void) | null>(null);

/** Función para mostrar una notificación. Requiere ProveedorNotificaciones arriba. */
export function useNotificar(): (n: Notificacion) => void {
  const notificar = useContext(Contexto);
  if (notificar === null) throw new Error("useNotificar se usó fuera de ProveedorNotificaciones: envuelve la pantalla con él.");
  return notificar;
}

/**
 * Región de notificaciones. Es opaca (no suma capas de desenfoque) y se
 * anuncia con aria-live="polite"; los errores llevan role="alert".
 */
export function ProveedorNotificaciones({ children, etiquetaCerrar = "Cerrar notificación" }: { readonly children: ReactNode; readonly etiquetaCerrar?: string }) {
  const [lista, setLista] = useState<readonly Visible[]>([]);
  const siguiente = useRef(0);

  const quitar = useCallback((id: number) => setLista((l) => l.filter((n) => n.id !== id)), []);

  const notificar = useCallback(
    (n: Notificacion) => {
      const id = siguiente.current++;
      setLista((l) => [...l, { ...n, id }]);
      if (n.tono !== "error") setTimeout(() => quitar(id), DURACION_MS);
    },
    [quitar],
  );

  const valor = useMemo(() => notificar, [notificar]);

  const tarjeta = (n: Visible) => {
    const Icono = ICONOS[n.tono];
    return (
      <div key={n.id} role={n.tono === "error" ? "alert" : undefined} className="notificacion superficie pointer-events-auto flex gap-3 rounded-xl p-4 shadow-elevada">
        <Icono aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${COLOR_ICONO[n.tono]}`} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-blanco">{n.titulo}</p>
          {n.texto !== undefined && <p className="mt-0.5 text-sm text-hielo">{n.texto}</p>}
        </div>
        <button
          type="button"
          onClick={() => quitar(n.id)}
          aria-label={etiquetaCerrar}
          className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-lg text-hielo hover:bg-hielo/10"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  };

  const posicion =
    "pointer-events-none fixed right-4 left-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-96 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6";

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div aria-live="polite" className={posicion}>
        {lista.map(tarjeta)}
      </div>
    </Contexto.Provider>
  );
}
