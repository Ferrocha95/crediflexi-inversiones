"use client";

import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../app/acceso/acciones";
import { TEXTOS_ESTRUCTURA as T } from "./textos";

export type RolUsuario = "DIRECTOR_REGIONAL" | "GERENTE" | "EJECUTIVO";

/** Lo único del usuario que llega al navegador: sin ids ni correo. */
export interface UsuarioMenu {
  readonly nombre: string;
  readonly rol: RolUsuario;
  readonly sucursal: string;
}

const ROLES: Record<RolUsuario, string> = {
  DIRECTOR_REGIONAL: "Director regional",
  GERENTE: "Gerente",
  EJECUTIVO: "Ejecutivo",
};

export function rolLegible(rol: RolUsuario): string {
  return ROLES[rol];
}

/**
 * Cierra la sesión y navega a /acceso con una carga completa (limpia lo que el
 * navegador tenía en memoria). Si la acción falla, por ejemplo porque la
 * sesión ya expiró y el proxy respondió 401, igual lleva a /acceso.
 */
export async function salirDeLaSesion(cerrar: () => Promise<void>, navegar: (ruta: string) => void): Promise<void> {
  try {
    await cerrar();
  } catch {
    // Sin sesión no hay nada que cerrar: se sigue a /acceso.
  }
  navegar("/acceso");
}

async function salir() {
  await salirDeLaSesion(cerrarSesion, (ruta) => window.location.assign(ruta));
}

/**
 * Nombre, rol y sucursal con el botón "Cerrar sesión". Para el menú lateral
 * (con `soloAbierto`, las clases que lo ocultan a la vista con el menú plegado)
 * y para el diálogo "Más" del celular.
 */
export function BloqueUsuario({ usuario, soloAbierto = "" }: { readonly usuario: UsuarioMenu; readonly soloAbierto?: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-hielo/15 pt-4">
      <div className={`flex flex-col px-2 leading-tight ${soloAbierto}`}>
        <span className="font-bold text-blanco">{usuario.nombre}</span>
        <span className="text-sm text-hielo">{rolLegible(usuario.rol)}</span>
        <span className="text-sm text-hielo">{usuario.sucursal}</span>
      </div>
      <form action={salir}>
        <button
          type="submit"
          title={T.cerrarSesion}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 font-semibold text-hielo hover:bg-hielo/8 hover:text-blanco"
        >
          <LogOut aria-hidden="true" className="size-5 shrink-0" />
          <span className={soloAbierto}>{T.cerrarSesion}</span>
        </button>
      </form>
    </div>
  );
}

/** Encabezado del celular: nombre, rol y sucursal, y un botón de ícono para cerrar sesión. */
export function EncabezadoUsuario({ usuario }: { readonly usuario: UsuarioMenu }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-col text-right leading-tight">
        <span className="truncate text-sm font-bold text-blanco">{usuario.nombre}</span>
        <span className="truncate text-xs text-hielo">{`${rolLegible(usuario.rol)} · ${usuario.sucursal}`}</span>
      </div>
      <form action={salir}>
        <button
          type="submit"
          aria-label={T.cerrarSesion}
          title={T.cerrarSesion}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-hielo hover:bg-hielo/8 hover:text-blanco"
        >
          <LogOut aria-hidden="true" className="size-5" />
        </button>
      </form>
    </div>
  );
}
