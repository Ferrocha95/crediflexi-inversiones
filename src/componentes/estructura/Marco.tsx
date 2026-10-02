import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProveedorNotificaciones } from "../ui/Notificaciones";
import { BarraInferior } from "./BarraInferior";
import { MenuLateral } from "./MenuLateral";
import { TEXTOS_ESTRUCTURA as T } from "./textos";

/**
 * Estructura de todas las pantallas: enlace para saltar al contenido, menú
 * lateral (desde 768 px) o encabezado con logo y barra inferior (celular).
 */
export function Marco({ children }: { readonly children: ReactNode }) {
  return (
    <ProveedorNotificaciones>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-xl bg-hielo px-4 py-3 font-bold text-marino focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {T.saltarContenido}
      </a>
      <div className="flex min-h-dvh">
        <MenuLateral />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center px-4 pt-4 md:hidden">
            <Link href="/" aria-label={T.irAlInicio} className="flex min-h-11 items-center rounded-xl">
              <Image src="/logo-blanco.png" alt="" width={640} height={201} loading="eager" unoptimized className="h-auto w-40" />
            </Link>
          </header>
          <main
            id="contenido"
            tabIndex={-1}
            className="flex flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:pb-0"
          >
            {children}
          </main>
        </div>
      </div>
      <BarraInferior />
    </ProveedorNotificaciones>
  );
}
