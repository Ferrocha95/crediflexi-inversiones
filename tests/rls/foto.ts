// "Foto" de los datos base (organizaciones A y B, sucursales A1, A2 y B1, y los
// 10 usuarios de fixtures.ts con sus cuentas de auth). Sirve para comprobar que
// ningún intento de escritura ni ninguna prueba de integridad los alteró.
//
// Sin dependencias de Vitest y sin llaves: recibe el cliente administrador.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaveOrganizacion, ClaveSucursal, ClaveUsuario } from "./fixtures";

export interface IdsDatos {
  idsOrganizaciones: Record<ClaveOrganizacion, string>;
  idsSucursales: Record<ClaveSucursal, string>;
  idsUsuarios: Record<ClaveUsuario, string>;
}

export interface FotoBase {
  organizaciones: Record<string, unknown>[];
  sucursales: Record<string, unknown>[];
  usuarios: Record<string, unknown>[];
  cuentas: { id: string; email: string | null }[];
}

async function filas(
  admin: SupabaseClient,
  tabla: "organizaciones" | "sucursales" | "usuarios",
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const { data, error } = await admin.from(tabla).select("*").in("id", ids).order("id");
  if (error) {
    throw new Error(`No se pudo leer ${tabla} para la foto de datos base: ${error.message}`);
  }
  return data;
}

export async function tomarFotoBase(
  admin: SupabaseClient,
  ids: IdsDatos,
): Promise<FotoBase> {
  const usuarios = await filas(admin, "usuarios", Object.values(ids.idsUsuarios));

  const cuentas: FotoBase["cuentas"] = [];
  for (const u of usuarios) {
    const { data, error } = await admin.auth.admin.getUserById(u.auth_id as string);
    if (error) {
      throw new Error(`No se pudo leer una cuenta de auth para la foto de datos base: ${error.message}`);
    }
    cuentas.push({ id: data.user.id, email: data.user.email ?? null });
  }

  return {
    organizaciones: await filas(admin, "organizaciones", Object.values(ids.idsOrganizaciones)),
    sucursales: await filas(admin, "sucursales", Object.values(ids.idsSucursales)),
    usuarios,
    cuentas,
  };
}
