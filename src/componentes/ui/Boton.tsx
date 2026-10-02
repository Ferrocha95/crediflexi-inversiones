import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-hielo text-marino hover:bg-blanco",
  secundario: "superficie text-blanco hover:bg-[#164679]",
  fantasma: "bg-transparent text-hielo hover:bg-hielo/10",
};

export interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: Variante;
  /** Muestra un indicador de carga y deshabilita el botón. */
  readonly cargando?: boolean;
  readonly icono?: ReactNode;
}

/** Botón de 44 px de alto como mínimo (objetivo táctil). */
export function Boton({
  variante = "primario",
  cargando = false,
  icono,
  className = "",
  disabled,
  children,
  type = "button",
  ...resto
}: PropsBoton) {
  return (
    <button
      type={type}
      disabled={disabled === true || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-5 font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTES[variante]} ${className}`}
      {...resto}
    >
      {cargando ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : icono}
      {children}
    </button>
  );
}
