import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface PropsCasilla extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly etiqueta: ReactNode;
}

/** Casilla de verificación nativa con una fila de 44 px para tocarla. */
export function Casilla({ etiqueta, className = "", ...props }: PropsCasilla) {
  return (
    <label
      className={`group flex min-h-11 cursor-pointer items-start gap-3 py-2.5 has-disabled:cursor-not-allowed has-disabled:opacity-55 ${className}`}
    >
      <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
        <input
          type="checkbox"
          className="peer size-6 cursor-pointer appearance-none rounded-md border-2 border-hielo/60 bg-marino/70 transition-colors duration-150 checked:border-hielo checked:bg-hielo disabled:cursor-not-allowed"
          {...props}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute size-4 text-marino opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className="text-blanco">{etiqueta}</span>
    </label>
  );
}
