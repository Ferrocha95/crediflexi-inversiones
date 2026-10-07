"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialogo } from "../ui/Dialogo";
import { DESTINOS, EN_BARRA, esDestinoActual, type Destino } from "./navegacion";
import { TEXTOS_ESTRUCTURA as T } from "./textos";
import { BloqueUsuario, type UsuarioMenu } from "./Usuario";

const BASE_BARRA =
  "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-xs font-semibold";
const BASE_LISTA = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold";

function MarcaActiva() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0 right-1/4 left-1/4 h-1 rounded-b-full bg-linear-to-r from-rojo via-naranja to-amarillo"
    />
  );
}

/** Un destino: enlace si existe, botón "Próximamente" que no navega si no. */
function ItemDestino({ d, actual, enLista, alNavegar }: { d: Destino; actual: string; enLista: boolean; alNavegar?: () => void }) {
  const activo = d.disponible && esDestinoActual(d.ruta, actual);
  const base = enLista ? BASE_LISTA : BASE_BARRA;
  const contenido = enLista ? (
    <>
      <d.Icono aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex flex-1 flex-col leading-tight">
        {d.etiqueta}
        {!d.disponible && <span className="text-xs font-semibold text-hielo-tenue">{T.proximamente}</span>}
      </span>
    </>
  ) : (
    <>
      <d.Icono aria-hidden="true" className="size-6" />
      <span className="max-w-full truncate">{d.corta}</span>
    </>
  );
  if (d.disponible) {
    return (
      <Link
        href={d.ruta}
        onClick={alNavegar}
        aria-current={activo ? "page" : undefined}
        className={`${base} ${activo ? "text-blanco" : "text-hielo"} ${enLista && activo ? "bg-hielo/12" : ""}`}
      >
        {activo && !enLista && <MarcaActiva />}
        {contenido}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={`${d.etiqueta}, ${T.proximamente}`}
      className={`${base} cursor-not-allowed text-hielo-tenue`}
    >
      {contenido}
    </button>
  );
}

/**
 * Barra de navegación del celular (menos de 768 px), fija abajo y con vidrio
 * más opaco. Caben cuatro destinos; los demás van en el diálogo "Más".
 */
export function BarraInferior({ usuario }: { readonly usuario: UsuarioMenu }) {
  const actual = usePathname();
  const [abierto, setAbierto] = useState(false);
  const visibles = DESTINOS.slice(0, EN_BARRA);
  const resto = DESTINOS.slice(EN_BARRA);
  const restoActivo = resto.some((d) => d.disponible && esDestinoActual(d.ruta, actual));

  return (
    <nav
      aria-label={T.navegacionPrincipal}
      className="barra-vidrio fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {visibles.map((d) => (
          <li key={d.ruta}>
            <ItemDestino d={d} actual={actual} enLista={false} />
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setAbierto(true)}
            className={`${BASE_BARRA} ${restoActivo ? "text-blanco" : "text-hielo"}`}
          >
            {restoActivo && <MarcaActiva />}
            <Ellipsis aria-hidden="true" className="size-6" />
            <span>{T.mas}</span>
          </button>
        </li>
      </ul>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={T.masDestinos}>
        <ul className="flex flex-col gap-1">
          {resto.map((d) => (
            <li key={d.ruta}>
              <ItemDestino d={d} actual={actual} enLista alNavegar={() => setAbierto(false)} />
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <BloqueUsuario usuario={usuario} />
        </div>
      </Dialogo>
    </nav>
  );
}
