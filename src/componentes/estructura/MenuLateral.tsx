"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { DESTINOS, esDestinoActual } from "./navegacion";
import { TEXTOS_ESTRUCTURA as T } from "./textos";
import { BloqueUsuario, type UsuarioMenu } from "./Usuario";

/** "auto": plegado de 768 a 1279 px y abierto de 1280 en adelante (lo decide el CSS, sin saltos al cargar). */
type Plegado = "auto" | "si" | "no";

const CONSULTA_ANCHO = "(min-width: 1280px)";

function suscribirAncho(avisar: () => void) {
  const m = window.matchMedia(CONSULTA_ANCHO);
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
}

/** Clase para lo que se oculta (solo a la vista) cuando el menú está plegado. */
const SOLO_ABIERTO =
  "group-data-[plegado=si]/menu:sr-only md:max-xl:group-data-[plegado=auto]/menu:sr-only";

/**
 * Menú lateral de escritorio y tableta (desde 768 px), con vidrio. Plegado
 * deja solo los íconos; las etiquetas siguen en el DOM para el lector de
 * pantalla. El estado vive solo en React: no se guarda.
 */
export function MenuLateral({ usuario }: { readonly usuario: UsuarioMenu }) {
  const actual = usePathname();
  const [plegado, setPlegado] = useState<Plegado>("auto");
  const anchoGrande = useSyncExternalStore(
    suscribirAncho,
    () => window.matchMedia(CONSULTA_ANCHO).matches,
    () => true,
  );
  const abierto = plegado === "no" || (plegado === "auto" && anchoGrande);

  return (
    <aside
      data-plegado={plegado}
      className="group/menu vidrio relative z-30 hidden shrink-0 rounded-none border-y-0 border-l-0 transition-[width] duration-250 ease-suave md:block w-62 data-[plegado=si]:w-18 md:max-xl:data-[plegado=auto]:w-18"
    >
      {/* El vidrio cubre toda la altura de la página; el contenido se queda fijo al hacer scroll. */}
      <div className="sticky top-0 flex h-dvh flex-col gap-6 px-3 py-5">
      <Link
        href="/"
        aria-label={T.irAlInicio}
        className="flex min-h-11 items-center rounded-xl px-2 py-1"
      >
        <Image
          src="/logo-blanco.png"
          alt=""
          width={640}
          height={201}
          loading="eager"
          unoptimized
          className={`h-auto w-48 ${SOLO_ABIERTO}`}
        />
        <span
          aria-hidden="true"
          className="hidden size-11 place-items-center rounded-xl bg-marino-alto text-xl font-extrabold group-data-[plegado=si]/menu:grid md:max-xl:group-data-[plegado=auto]/menu:grid"
        >
          C
        </span>
      </Link>

      <nav aria-label={T.navegacionPrincipal} className="flex-1">
        <ul className="flex flex-col gap-1">
          {DESTINOS.map((d) => {
            const activo = d.disponible && esDestinoActual(d.ruta, actual);
            const base =
              "relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left font-semibold transition-colors duration-150";
            const contenido = (
              <>
                <d.Icono aria-hidden="true" className="size-5 shrink-0" />
                <span className={`flex flex-1 flex-col leading-tight ${SOLO_ABIERTO}`}>
                  {d.etiqueta}
                  {!d.disponible && <span className="text-xs font-semibold text-hielo-tenue">{T.proximamente}</span>}
                </span>
              </>
            );
            return (
              <li key={d.ruta}>
                {d.disponible ? (
                  <Link
                    href={d.ruta}
                    aria-current={activo ? "page" : undefined}
                    title={d.etiqueta}
                    className={`${base} ${activo ? "bg-hielo/12 text-blanco" : "text-hielo hover:bg-hielo/8 hover:text-blanco"}`}
                  >
                    {activo && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-linear-to-t from-rojo via-naranja to-amarillo"
                      />
                    )}
                    {contenido}
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-disabled="true"
                    aria-label={`${d.etiqueta}, ${T.proximamente}`}
                    title={`${d.etiqueta}: ${T.proximamente.toLowerCase()}`}
                    className={`${base} cursor-not-allowed text-hielo-tenue`}
                  >
                    {contenido}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <BloqueUsuario usuario={usuario} soloAbierto={SOLO_ABIERTO} />

      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setPlegado(abierto ? "si" : "no")}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3.5 font-semibold text-hielo hover:bg-hielo/8 hover:text-blanco"
      >
        {abierto ? (
          <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" />
        ) : (
          <PanelLeftOpen aria-hidden="true" className="size-5 shrink-0" />
        )}
        <span className={SOLO_ABIERTO}>{abierto ? T.plegarMenu : T.desplegarMenu}</span>
      </button>
      </div>
    </aside>
  );
}
