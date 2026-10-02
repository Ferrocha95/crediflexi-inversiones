"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESTINOS, esDestinoActual } from "./navegacion";
import { TEXTOS_ESTRUCTURA as T } from "./textos";

/** Barra de navegación del celular (menos de 768 px), fija abajo y con vidrio más opaco. */
export function BarraInferior() {
  const actual = usePathname();
  return (
    <nav
      aria-label={T.navegacionPrincipal}
      className="barra-vidrio fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {DESTINOS.map((d) => {
          const activo = d.disponible && esDestinoActual(d.ruta, actual);
          const base =
            "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs font-semibold";
          const contenido = (
            <>
              <d.Icono aria-hidden="true" className="size-6" />
              <span className="max-w-full truncate">{d.corta}</span>
              {!d.disponible && <span className="sr-only">{`, ${T.proximamente}`}</span>}
            </>
          );
          return (
            <li key={d.ruta}>
              {d.disponible ? (
                <Link
                  href={d.ruta}
                  aria-current={activo ? "page" : undefined}
                  className={`${base} ${activo ? "text-blanco" : "text-hielo"}`}
                >
                  {activo && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 right-1/4 left-1/4 h-1 rounded-b-full bg-linear-to-r from-rojo via-naranja to-amarillo"
                    />
                  )}
                  {contenido}
                </Link>
              ) : (
                <button type="button" aria-disabled="true" className={`${base} cursor-not-allowed text-hielo-tenue`}>
                  {contenido}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
