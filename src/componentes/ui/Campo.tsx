import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** Clases del control (entrada, área de texto o selector): 44 px de alto como mínimo. */
export const CLASE_CONTROL =
  "w-full min-h-11 rounded-xl border border-hielo/25 bg-marino/70 px-3.5 py-2 text-base text-blanco " +
  "placeholder:text-hielo-tenue transition-colors duration-150 hover:border-hielo/45 " +
  "focus-visible:border-hielo disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-error-texto";

export interface PropsCampo {
  readonly id: string;
  readonly etiqueta: ReactNode;
  readonly ayuda?: ReactNode;
  readonly error?: ReactNode;
  /** Texto del contador de caracteres, alineado a la derecha. */
  readonly contador?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Etiqueta, control, ayuda, error y contador. Los identificadores de la ayuda,
 * el error y el contador son `${id}-ayuda`, `${id}-error` y `${id}-contador`,
 * para enlazarlos con aria-describedby desde el control.
 */
export function Campo({ id, etiqueta, ayuda, error, contador, children, className = "" }: PropsCampo) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-semibold text-hielo">
        {etiqueta}
      </label>
      {children}
      {ayuda !== undefined && (
        <p id={`${id}-ayuda`} className="text-sm text-hielo-tenue">
          {ayuda}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm font-semibold text-error-texto">
          {error}
        </p>
      )}
      {contador !== undefined && (
        <p id={`${id}-contador`} className="text-right text-sm text-hielo-tenue">
          {contador}
        </p>
      )}
    </div>
  );
}

export function Entrada({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CLASE_CONTROL} ${className}`} {...props} />;
}

export function AreaTexto({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CLASE_CONTROL} resize-y ${className}`} {...props} />;
}
