// Datos sintéticos para las pruebas de RLS. Todo es ficticio.
// Los correos usan el dominio reservado @rls.test y los nombres de
// organizaciones y sucursales llevan la marca MARCA para poder limpiarlos.

export const DOMINIO_PRUEBAS = "@rls.test";
export const MARCA = "(rls.test)";

export type ClaveOrganizacion = "A" | "B";
export type ClaveSucursal = "A1" | "A2" | "B1";
export type ClaveUsuario =
  | "D1"
  | "G1"
  | "E1"
  | "E2"
  | "G2"
  | "E3"
  | "E5"
  | "E6"
  | "D2"
  | "E4";

export type Rol = "DIRECTOR_REGIONAL" | "GERENTE" | "EJECUTIVO";

export interface FixtureOrganizacion {
  clave: ClaveOrganizacion;
  nombre: string;
}

export interface FixtureSucursal {
  clave: ClaveSucursal;
  organizacion: ClaveOrganizacion;
  nombre: string;
}

export interface FixtureUsuario {
  clave: ClaveUsuario;
  nombre: string;
  rol: Rol;
  sucursal: ClaveSucursal;
  jefe: ClaveUsuario | null;
  activo: boolean;
}

export const ORGANIZACIONES: readonly FixtureOrganizacion[] = [
  { clave: "A", nombre: `Organización A ${MARCA}` },
  { clave: "B", nombre: `Organización B ${MARCA}` },
];

export const SUCURSALES: readonly FixtureSucursal[] = [
  { clave: "A1", organizacion: "A", nombre: `Sucursal 1 ${MARCA}` },
  { clave: "A2", organizacion: "A", nombre: `Sucursal 2 ${MARCA}` },
  { clave: "B1", organizacion: "B", nombre: `Sucursal B1 ${MARCA}` },
];

// Ordenados para que cada jefe se cree antes que sus subordinados.
//
// Organización A
//   Sucursal 1: D1 (director) -> G1 (gerente) -> E1, E2 y E5 (inactivo)
//   Sucursal 2: G2 (gerente, bajo D1) -> E3
//               E6 (ejecutivo de sucursal 2, pero su jefe es G1)
// Organización B
//   D2 (director) -> E4
export const USUARIOS: readonly FixtureUsuario[] = [
  { clave: "D1", nombre: "Director Uno", rol: "DIRECTOR_REGIONAL", sucursal: "A1", jefe: null, activo: true },
  { clave: "G1", nombre: "Gerente Uno", rol: "GERENTE", sucursal: "A1", jefe: "D1", activo: true },
  { clave: "E1", nombre: "Ejecutivo Uno", rol: "EJECUTIVO", sucursal: "A1", jefe: "G1", activo: true },
  { clave: "E2", nombre: "Ejecutivo Dos", rol: "EJECUTIVO", sucursal: "A1", jefe: "G1", activo: true },
  { clave: "E5", nombre: "Ejecutivo Cinco Inactivo", rol: "EJECUTIVO", sucursal: "A1", jefe: "G1", activo: false },
  { clave: "G2", nombre: "Gerente Dos", rol: "GERENTE", sucursal: "A2", jefe: "D1", activo: true },
  { clave: "E3", nombre: "Ejecutivo Tres", rol: "EJECUTIVO", sucursal: "A2", jefe: "G2", activo: true },
  { clave: "E6", nombre: "Ejecutivo Seis", rol: "EJECUTIVO", sucursal: "A2", jefe: "G1", activo: true },
  { clave: "D2", nombre: "Director Dos", rol: "DIRECTOR_REGIONAL", sucursal: "B1", jefe: null, activo: true },
  { clave: "E4", nombre: "Ejecutivo Cuatro", rol: "EJECUTIVO", sucursal: "B1", jefe: "D2", activo: true },
];

export function correoDe(clave: ClaveUsuario): string {
  return `${clave.toLowerCase()}${DOMINIO_PRUEBAS}`;
}

// Prospectos base, creados por el administrador con su ejecutivo explícito.
// Nombres y teléfonos sintéticos. PE1x nace archivado.
export type ClaveProspecto = "PE1" | "PE1x" | "PE2" | "PE3" | "PE5" | "PE6" | "PG1" | "PE4";

export type EstatusProspecto = "INTERESADO" | "INTERMITENTE" | "NO_INTERESADO";

export interface FixtureProspecto {
  clave: ClaveProspecto;
  ejecutivo: ClaveUsuario;
  nombre: string;
  contacto: string;
  estatus: EstatusProspecto;
  seguimiento: string | null;
  archivado: boolean;
}

export const PROSPECTOS: readonly FixtureProspecto[] = [
  { clave: "PE1", ejecutivo: "E1", nombre: `Prospecto Sintético 01 ${MARCA}`, contacto: "5500000001", estatus: "INTERESADO", seguimiento: "2026-10-05", archivado: false },
  { clave: "PE1x", ejecutivo: "E1", nombre: `Prospecto Sintético 02 ${MARCA}`, contacto: "5500000002", estatus: "NO_INTERESADO", seguimiento: null, archivado: true },
  { clave: "PE2", ejecutivo: "E2", nombre: `Prospecto Sintético 03 ${MARCA}`, contacto: "5500000003", estatus: "INTERMITENTE", seguimiento: "2026-10-06", archivado: false },
  { clave: "PE3", ejecutivo: "E3", nombre: `Prospecto Sintético 04 ${MARCA}`, contacto: "5500000004", estatus: "INTERESADO", seguimiento: null, archivado: false },
  { clave: "PE5", ejecutivo: "E5", nombre: `Prospecto Sintético 05 ${MARCA}`, contacto: "5500000005", estatus: "INTERMITENTE", seguimiento: "2026-10-07", archivado: false },
  { clave: "PE6", ejecutivo: "E6", nombre: `Prospecto Sintético 06 ${MARCA}`, contacto: "5500000006", estatus: "NO_INTERESADO", seguimiento: "2026-10-08", archivado: false },
  { clave: "PG1", ejecutivo: "G1", nombre: `Prospecto Sintético 07 ${MARCA}`, contacto: "5500000007", estatus: "INTERESADO", seguimiento: "2026-10-09", archivado: false },
  { clave: "PE4", ejecutivo: "E4", nombre: `Prospecto Sintético 08 ${MARCA}`, contacto: "5500000008", estatus: "INTERESADO", seguimiento: null, archivado: false },
];
