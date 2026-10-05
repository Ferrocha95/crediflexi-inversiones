// Cliente administrador (service_role) para pruebas que necesitan escribir o
// comprobar datos por encima de RLS, y un registro para que cada prueba borre
// lo que creó, pase o falle.
//
// Cómo se limita la exposición de la llave secreta:
// - No viaja por provide/inject, variables de entorno ni archivos: comoAdmin()
//   la lee de `supabase status` dentro del worker, con el mismo chequeo de host
//   local de entorno.ts, y la entrega directo a createClient.
// - Solo existe dentro del cliente en memoria de este módulo; nunca se guarda
//   en otra variable exportada, nunca se imprime y los errores que lanzamos
//   solo llevan mensajes de Supabase/Postgres, no la configuración del cliente.
// - Únicamente la cargan los archivos de prueba que importan este módulo.

import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { OPCIONES_CLIENTE, leerEntornoLocal } from "./entorno";
import { DOMINIO_PRUEBAS, MARCA, type EstatusProspecto, type Rol } from "./fixtures";

let clienteAdmin: SupabaseClient | undefined;

export function comoAdmin(): SupabaseClient {
  if (!clienteAdmin) {
    const { url, llaveSecreta } = leerEntornoLocal();
    clienteAdmin = createClient(url, llaveSecreta, OPCIONES_CLIENTE);
  }
  return clienteAdmin;
}

function falla(accion: string, mensaje: string): never {
  throw new Error(`No se pudo ${accion}: ${mensaje}`);
}

// Sufijo corto y único para que los nombres de cada prueba no choquen.
export function sufijo(): string {
  return randomUUID().slice(0, 8);
}

export interface UsuarioCreado {
  id: string;
  authId: string;
  correo: string;
  contrasena: string;
}

// Lleva la cuenta de todo lo que crea una prueba y lo borra en el orden que
// exigen los "on delete restrict". Se usa con afterEach para que corra aunque
// la prueba falle.
export class Registro {
  readonly organizaciones: string[] = [];
  readonly sucursales: string[] = [];
  readonly usuarios: string[] = [];
  readonly prospectos: string[] = [];
  readonly cuentas: string[] = [];

  constructor(private readonly admin: SupabaseClient = comoAdmin()) {}

  async crearOrganizacion(base = "Org"): Promise<string> {
    const { data, error } = await this.admin
      .from("organizaciones")
      .insert({ nombre: `${base} ${sufijo()} ${MARCA}` })
      .select("id")
      .single();
    if (error) falla("crear una organización de prueba", error.message);
    this.organizaciones.push(data.id);
    return data.id;
  }

  async crearSucursal(organizacionId: string, base = "Suc"): Promise<string> {
    const { data, error } = await this.admin
      .from("sucursales")
      .insert({ organizacion_id: organizacionId, nombre: `${base} ${sufijo()} ${MARCA}` })
      .select("id")
      .single();
    if (error) falla("crear una sucursal de prueba", error.message);
    this.sucursales.push(data.id);
    return data.id;
  }

  async crearCuenta(): Promise<{ authId: string; correo: string; contrasena: string }> {
    const correo = `int-${sufijo()}${DOMINIO_PRUEBAS}`;
    const contrasena = randomBytes(24).toString("base64url");
    const { data, error } = await this.admin.auth.admin.createUser({
      email: correo,
      password: contrasena,
      email_confirm: true,
    });
    if (error) falla("crear una cuenta de prueba", error.message);
    this.cuentas.push(data.user.id);
    return { authId: data.user.id, correo, contrasena };
  }

  async crearUsuario(opciones: {
    sucursalId: string;
    jefeId?: string | null;
    rol?: Rol;
    activo?: boolean;
  }): Promise<UsuarioCreado> {
    const cuenta = await this.crearCuenta();
    const { data, error } = await this.admin
      .from("usuarios")
      .insert({
        auth_id: cuenta.authId,
        nombre: `Usuario ${sufijo()}`,
        rol: opciones.rol ?? "EJECUTIVO",
        sucursal_id: opciones.sucursalId,
        jefe_id: opciones.jefeId ?? null,
        activo: opciones.activo ?? true,
      })
      .select("id")
      .single();
    if (error) falla("crear un usuario de prueba", error.message);
    this.usuarios.push(data.id);
    return { id: data.id, ...cuenta };
  }

  // Prospecto con ejecutivo explícito (el valor por omisión, el usuario
  // actual, no existe para el administrador). Datos sintéticos.
  async crearProspecto(opciones: {
    ejecutivoId: string;
    estatus?: EstatusProspecto;
    contacto?: string;
    archivado?: boolean;
  }): Promise<string> {
    const { data, error } = await this.admin
      .from("prospectos")
      .insert({
        ejecutivo_id: opciones.ejecutivoId,
        nombre: `Prospecto Sintético ${sufijo()} ${MARCA}`,
        contacto: opciones.contacto ?? "5500000099",
        estatus: opciones.estatus ?? "INTERESADO",
        archivado_en: opciones.archivado ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) falla("crear un prospecto de prueba", error.message);
    this.prospectos.push(data.id);
    return data.id;
  }

  // Registra filas que una prueba insertó por su cuenta (por ejemplo, un
  // insert que debía fallar y no falló), para que también se borren.
  anotar(
    tabla: "organizaciones" | "sucursales" | "usuarios" | "prospectos",
    filas: { id: string }[] | null,
  ): void {
    for (const f of filas ?? []) this[tabla].push(f.id);
  }

  async limpiar(): Promise<void> {
    const errores: string[] = [];
    const anotarError = (accion: string, e: { message: string } | null) => {
      if (e) errores.push(`${accion}: ${e.message}`);
    };

    // prospectos.ejecutivo_id es "on delete restrict": van antes que usuarios.
    if (this.prospectos.length > 0) {
      const { error } = await this.admin.from("prospectos").delete().in("id", this.prospectos);
      anotarError("borrar prospectos", error);
    }
    if (this.usuarios.length > 0) {
      const soltar = await this.admin.from("usuarios").update({ jefe_id: null }).in("id", this.usuarios);
      anotarError("soltar jefes", soltar.error);
      const borrar = await this.admin.from("usuarios").delete().in("id", this.usuarios);
      anotarError("borrar usuarios", borrar.error);
    }
    if (this.sucursales.length > 0) {
      const { error } = await this.admin.from("sucursales").delete().in("id", this.sucursales);
      anotarError("borrar sucursales", error);
    }
    if (this.organizaciones.length > 0) {
      const { error } = await this.admin.from("organizaciones").delete().in("id", this.organizaciones);
      anotarError("borrar organizaciones", error);
    }
    for (const id of this.cuentas) {
      const { error } = await this.admin.auth.admin.deleteUser(id);
      anotarError("borrar una cuenta", error);
    }

    this.organizaciones.length = 0;
    this.sucursales.length = 0;
    this.usuarios.length = 0;
    this.prospectos.length = 0;
    this.cuentas.length = 0;

    if (errores.length > 0) {
      throw new Error(
        `La limpieza de la prueba quedó incompleta (${errores.join("; ")}). ` +
          "El teardown global volverá a intentarlo; si persiste, corre npm run db:reset.",
      );
    }
  }
}
