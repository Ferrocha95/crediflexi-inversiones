import type { ReactNode } from "react";
import { LineaFlecha } from "./LineaFlecha";
import { NumeroAnimado } from "./NumeroAnimado";

type Tamano = "grande" | "mediano";

const TAMANOS: Record<Tamano, string> = {
  grande: "text-4xl sm:text-cifra",
  mediano: "text-2xl",
};

export interface PropsTarjetaCifra {
  readonly etiqueta: ReactNode;
  /** La cifra ya formateada (texto). */
  readonly valor: string;
  /** "positivo" la pinta en el verde de marca (siempre a 24 px o más, para el contraste). */
  readonly tono?: "positivo" | "neutro";
  readonly tamano?: Tamano;
  /** Dibuja la flecha de la marca debajo de la cifra. */
  readonly flecha?: boolean;
  /** Desglose: de dónde sale la cifra (regla 7). */
  readonly children?: ReactNode;
  readonly className?: string;
}

/** Cifra con su etiqueta, número animado y desglose. No calcula nada: muestra lo que recibe. */
export function TarjetaCifra({
  etiqueta,
  valor,
  tono = "neutro",
  tamano = "mediano",
  flecha = false,
  children,
  className = "",
}: PropsTarjetaCifra) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <p className="font-semibold text-hielo">{etiqueta}</p>
      <p className={`font-extrabold tracking-tight ${TAMANOS[tamano]} ${tono === "positivo" ? "text-verde" : "text-blanco"}`}>
        <NumeroAnimado valor={valor} />
      </p>
      {flecha && <LineaFlecha className="mt-1 max-w-72" />}
      {children !== undefined && <div className="mt-2 text-sm text-hielo">{children}</div>}
    </div>
  );
}
