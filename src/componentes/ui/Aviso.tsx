import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type Tono = "error" | "advertencia" | "exito" | "info";

const TONOS: Record<Tono, { clases: string; Icono: typeof Info }> = {
  error: { clases: "border-error-texto/70 bg-[#3A1630]/70 [--tono:var(--color-error-texto)]", Icono: CircleAlert },
  advertencia: { clases: "border-amarillo/70 bg-[#2E2F3A]/70 [--tono:var(--color-amarillo)]", Icono: TriangleAlert },
  exito: { clases: "border-verde-texto/70 bg-[#0B3A3F]/70 [--tono:var(--color-verde-texto)]", Icono: CircleCheck },
  info: { clases: "border-hielo/40 bg-marino-alto/70 [--tono:var(--color-hielo)]", Icono: Info },
};

export interface PropsAviso {
  readonly tono: Tono;
  readonly titulo: ReactNode;
  readonly children?: ReactNode;
  /** "alert" para errores que deben anunciarse en cuanto aparecen. */
  readonly role?: "alert" | "status";
  readonly className?: string;
}

/** Aviso en línea: error, advertencia, éxito o información. Dice qué pasó y qué hacer. */
export function Aviso({ tono, titulo, children, role, className = "" }: PropsAviso) {
  const { clases, Icono } = TONOS[tono];
  return (
    <div role={role} className={`flex gap-3 rounded-xl border p-4 ${clases} ${className}`}>
      <Icono aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--tono)" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-blanco">{titulo}</p>
        {children !== undefined && <div className="mt-1 text-hielo">{children}</div>}
      </div>
    </div>
  );
}
