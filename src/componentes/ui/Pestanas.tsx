"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface Pestana {
  readonly clave: string;
  readonly etiqueta: ReactNode;
  readonly contenido: ReactNode;
}

export interface PropsPestanas {
  readonly etiqueta: string;
  readonly pestanas: readonly Pestana[];
  readonly inicial?: string;
}

/**
 * Pestañas con el patrón ARIA "tabs": Tab entra a la pestaña activa, las
 * flechas izquierda y derecha cambian de pestaña, Inicio y Fin van a la
 * primera y a la última.
 */
export function Pestanas({ etiqueta, pestanas, inicial }: PropsPestanas) {
  const id = useId();
  const [activa, setActiva] = useState(inicial ?? pestanas[0]?.clave ?? "");
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  function mover(e: KeyboardEvent<HTMLDivElement>) {
    const i = pestanas.findIndex((p) => p.clave === activa);
    const ultimo = pestanas.length - 1;
    const destino =
      e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;
    if (destino === null) return;
    e.preventDefault();
    setActiva(pestanas[destino].clave);
    botones.current[destino]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={etiqueta}
        onKeyDown={mover}
        className="flex gap-1 overflow-x-auto rounded-xl border border-hielo/20 bg-marino/60 p-1"
      >
        {pestanas.map((p, i) => {
          const seleccionada = p.clave === activa;
          return (
            <button
              key={p.clave}
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-pestana-${p.clave}`}
              aria-selected={seleccionada}
              aria-controls={`${id}-panel-${p.clave}`}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => setActiva(p.clave)}
              className={`min-h-11 min-w-11 shrink-0 rounded-lg px-4 font-semibold transition-colors duration-150 ${
                seleccionada ? "bg-hielo text-marino" : "text-hielo hover:bg-hielo/10"
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>
      {pestanas.map((p) => (
        <div
          key={p.clave}
          role="tabpanel"
          id={`${id}-panel-${p.clave}`}
          aria-labelledby={`${id}-pestana-${p.clave}`}
          hidden={p.clave !== activa}
          tabIndex={0}
        >
          {p.contenido}
        </div>
      ))}
    </div>
  );
}
