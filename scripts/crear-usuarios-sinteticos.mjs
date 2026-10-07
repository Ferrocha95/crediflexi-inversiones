// Crea usuarios SINTÉTICOS en Supabase local, para probar la app con sesión.
//
//   npm run usuarios:sinteticos
//     Crea la "Organización Sintética" con dos sucursales, un director, un
//     gerente, dos ejecutivos (@ejemplo.test) y 8 prospectos sintéticos.
//
//   npm run usuarios:sinteticos -- --correo fer.rocha@crediflexi.test --nombre "Fernando Rocha" --rol EJECUTIVO --sucursal Metepec
//     Crea UN usuario con esos datos en la organización "Crediflexi" (la crea
//     si no existe) y en la sucursal indicada (la crea si no existe).
//
// Solo local: se niega si la URL de Supabase no es localhost o 127.0.0.1. Usa
// la llave de servicio solo en memoria: nunca se imprime ni se escribe. Las
// contraseñas son aleatorias y se muestran UNA sola vez. Si los datos ya
// existen, se niega y explica cómo empezar de cero (npm run db:reset).

import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { generarContrasena } from "./contrasena.mjs";
import { leerSupabaseLocal } from "./supabase-local.mjs";

export const ORGANIZACION_SINTETICA = "Organización Sintética";
export const ORGANIZACION_NOMBRADA = "Crediflexi";

const ROLES = ["DIRECTOR_REGIONAL", "GERENTE", "EJECUTIVO"];
const ROL_LEGIBLE = { DIRECTOR_REGIONAL: "Director regional", GERENTE: "Gerente", EJECUTIVO: "Ejecutivo" };
const BANDERAS = ["correo", "nombre", "rol", "sucursal"];
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PARA_EMPEZAR_DE_CERO =
  "Para empezar de cero: npm run db:reset (borra TODOS los datos de la base local) y vuelve a correr este script.";

/** Lee las banderas. Sin banderas: el juego sintético completo; con las cuatro: un usuario nombrado. */
export function parsearArgumentos(argv) {
  const valores = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (!m || !BANDERAS.includes(m[1])) {
      throw new Error(`Bandera desconocida: ${arg}. Usa --correo, --nombre, --rol y --sucursal, o ninguna.`);
    }
    if (m[2] !== undefined) valores[m[1]] = m[2];
    else valores[m[1]] = argv[++i] ?? "";
  }
  if (Object.keys(valores).length === 0) return { modo: "sinteticos" };

  const faltan = BANDERAS.filter((b) => !(b in valores));
  if (faltan.length > 0) throw new Error(`Faltan banderas: ${faltan.map((b) => `--${b}`).join(", ")}. Para un usuario nombrado van las cuatro.`);

  const correo = valores.correo.trim().toLowerCase();
  const nombre = valores.nombre.trim();
  const rol = valores.rol.trim().toUpperCase();
  const sucursal = valores.sucursal.trim();
  if (!RE_CORREO.test(correo)) throw new Error(`El correo "${valores.correo}" no es válido.`);
  if (nombre === "") throw new Error("El nombre no puede ir vacío.");
  if (!ROLES.includes(rol)) throw new Error(`El rol "${valores.rol}" no existe: usa DIRECTOR_REGIONAL, GERENTE o EJECUTIVO.`);
  if (sucursal === "") throw new Error("La sucursal no puede ir vacía.");
  return { modo: "nombrado", correo, nombre, rol, sucursal };
}

/** Datos del juego sintético completo. Solo datos inventados. */
export function planSintetico() {
  const norte = "Sucursal Sintética Norte";
  const sur = "Sucursal Sintética Sur";
  const usuarios = [
    { clave: "director", correo: "director.sintetico@ejemplo.test", nombre: "Directora Sintética", rol: "DIRECTOR_REGIONAL", sucursal: norte, jefe: null },
    { clave: "gerente", correo: "gerente.sintetico@ejemplo.test", nombre: "Gerente Sintético", rol: "GERENTE", sucursal: norte, jefe: "director" },
    { clave: "ejecutivo1", correo: "ejecutivo.uno@ejemplo.test", nombre: "Ejecutiva Sintética Uno", rol: "EJECUTIVO", sucursal: norte, jefe: "gerente" },
    { clave: "ejecutivo2", correo: "ejecutivo.dos@ejemplo.test", nombre: "Ejecutivo Sintético Dos", rol: "EJECUTIVO", sucursal: sur, jefe: "gerente" },
  ];
  const estatus = ["INTERESADO", "INTERMITENTE", "NO_INTERESADO"];
  const prospectos = Array.from({ length: 8 }, (_, i) => ({
    nombre: `Prospecto Sintético ${String(i + 1).padStart(2, "0")}`,
    contacto: `55000000${String(i + 1).padStart(2, "0")}`,
    estatus: estatus[i % estatus.length],
    ejecutivo: i % 2 === 0 ? "ejecutivo1" : "ejecutivo2",
  }));
  return { organizacion: ORGANIZACION_SINTETICA, sucursales: [norte, sur], usuarios, prospectos };
}

function falla(accion, error) {
  throw new Error(`No se pudo ${accion}: ${error.message}`);
}

async function correosExistentes(admin, correos) {
  const buscados = new Set(correos.map((c) => c.toLowerCase()));
  const encontrados = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) falla("revisar los usuarios existentes", error);
    for (const u of data.users) if (u.email && buscados.has(u.email.toLowerCase())) encontrados.push(u.email);
    if (data.users.length < 1000) return encontrados;
  }
}

/** Crea la cuenta de Auth y su fila en usuarios; registra cómo deshacerlo. */
async function crearUsuario(admin, deshacer, { correo, nombre, rol, sucursalId, jefeId }) {
  const contrasena = generarContrasena();
  const cuenta = await admin.auth.admin.createUser({ email: correo, password: contrasena, email_confirm: true });
  if (cuenta.error) falla(`crear la cuenta de ${correo}`, cuenta.error);
  deshacer.push(() => admin.auth.admin.deleteUser(cuenta.data.user.id));

  const { data, error } = await admin
    .from("usuarios")
    .insert({ auth_id: cuenta.data.user.id, nombre, rol, sucursal_id: sucursalId, jefe_id: jefeId })
    .select("id")
    .single();
  if (error) falla(`crear el usuario ${nombre}`, error);
  deshacer.push(() => admin.from("usuarios").delete().eq("id", data.id));
  return { id: data.id, contrasena };
}

async function insertar(admin, deshacer, tabla, fila, descripcion) {
  const { data, error } = await admin.from(tabla).insert(fila).select("id").single();
  if (error) falla(`crear ${descripcion}`, error);
  deshacer.push(() => admin.from(tabla).delete().eq("id", data.id));
  return data.id;
}

/** Ejecuta `pasos`; si algo falla, deshace lo creado en orden inverso y relanza el error. */
async function conDeshacer(pasos) {
  const deshacer = [];
  try {
    return await pasos(deshacer);
  } catch (e) {
    for (const paso of deshacer.reverse()) await Promise.resolve(paso()).catch(() => undefined);
    throw e;
  }
}

async function crearSinteticos(admin) {
  const plan = planSintetico();
  const { data: orgs, error } = await admin.from("organizaciones").select("id").eq("nombre", plan.organizacion);
  if (error) falla("revisar las organizaciones", error);
  const repetidos = await correosExistentes(admin, plan.usuarios.map((u) => u.correo));
  if (orgs.length > 0 || repetidos.length > 0) {
    throw new Error(`Los datos sintéticos ya existen (${orgs.length > 0 ? plan.organizacion : repetidos.join(", ")}). ${PARA_EMPEZAR_DE_CERO}`);
  }

  return conDeshacer(async (deshacer) => {
    const orgId = await insertar(admin, deshacer, "organizaciones", { nombre: plan.organizacion }, "la organización");
    const sucursales = {};
    for (const nombre of plan.sucursales) {
      sucursales[nombre] = await insertar(admin, deshacer, "sucursales", { organizacion_id: orgId, nombre }, `la sucursal ${nombre}`);
    }
    const ids = {};
    const creados = [];
    for (const u of plan.usuarios) {
      const { id, contrasena } = await crearUsuario(admin, deshacer, {
        correo: u.correo,
        nombre: u.nombre,
        rol: u.rol,
        sucursalId: sucursales[u.sucursal],
        jefeId: u.jefe ? ids[u.jefe] : null,
      });
      ids[u.clave] = id;
      creados.push({ ...u, contrasena });
    }
    for (const p of plan.prospectos) {
      await insertar(
        admin,
        deshacer,
        "prospectos",
        { ejecutivo_id: ids[p.ejecutivo], nombre: p.nombre, contacto: p.contacto, estatus: p.estatus },
        `el prospecto ${p.nombre}`,
      );
    }
    return creados;
  });
}

async function crearNombrado(admin, { correo, nombre, rol, sucursal }) {
  if ((await correosExistentes(admin, [correo])).length > 0) {
    throw new Error(`Ya existe un usuario con el correo ${correo}. ${PARA_EMPEZAR_DE_CERO}`);
  }

  return conDeshacer(async (deshacer) => {
    // ilike sin comodines: igualdad sin distinguir mayúsculas, como el índice único de la base.
    const { data: orgs, error } = await admin.from("organizaciones").select("id").ilike("nombre", ORGANIZACION_NOMBRADA);
    if (error) falla("buscar la organización", error);
    const orgId =
      orgs.length > 0 ? orgs[0].id : await insertar(admin, deshacer, "organizaciones", { nombre: ORGANIZACION_NOMBRADA }, "la organización");

    const { data: sucursales, error: e2 } = await admin.from("sucursales").select("id, nombre").eq("organizacion_id", orgId);
    if (e2) falla("buscar la sucursal", e2);
    const existente = sucursales.find((s) => s.nombre.trim().toLowerCase() === sucursal.toLowerCase());
    const sucursalId =
      existente?.id ?? (await insertar(admin, deshacer, "sucursales", { organizacion_id: orgId, nombre: sucursal }, `la sucursal ${sucursal}`));

    const { contrasena } = await crearUsuario(admin, deshacer, { correo, nombre, rol, sucursalId, jefeId: null });
    return [{ correo, nombre, rol, sucursal, contrasena }];
  });
}

/** Primera línea del resultado: "datos sintéticos" solo en el modo sintético. */
export function encabezadoResultado(modo) {
  return modo === "sinteticos" ? "Usuarios creados en Supabase local (datos sintéticos)." : "Usuario creado en Supabase local.";
}

function mostrar(creados, modo) {
  const lineas = [
    encabezadoResultado(modo),
    "Las contraseñas se muestran UNA sola vez: cópialas ahora; no se guardan en ningún lado.",
    "",
    ...creados.map((u) => `${ROL_LEGIBLE[u.rol]} · ${u.nombre} · ${u.sucursal}\n  correo:     ${u.correo}\n  contraseña: ${u.contrasena}`),
    "",
    "Entra en http://127.0.0.1:3000/acceso (con npm run dev).",
  ];
  process.stdout.write(`${lineas.join("\n")}\n`);
}

async function principal() {
  try {
    const opciones = parsearArgumentos(process.argv.slice(2));
    const { url, llaveSecreta } = leerSupabaseLocal({ secreta: true });
    const admin = createClient(url, llaveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });
    const creados = opciones.modo === "sinteticos" ? await crearSinteticos(admin) : await crearNombrado(admin, opciones);
    mostrar(creados, opciones.modo);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : "No se pudieron crear los usuarios."}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await principal();
