import { NextResponse, type NextRequest } from "next/server";
import { RUTA_ACCESO } from "../../../aplicacion/acceso/rutas";
import { rechazoPorHost } from "../../../servidor/guardiaHost";
import { resolverSesion } from "../../../servidor/sesion";
import { crearClienteServidor } from "../../../servidor/supabase/servidor";

/**
 * Cierra la sesión de un usuario inactivo y lo deja en /acceso con el aviso.
 * Está bajo /acceso, fuera del refresco del proxy, así que no hay bucle: al
 * volver a /acceso ya no hay sesión. Además de signOut, borra las cookies de
 * Auth (sb-…) por si signOut no pudo hacerlo. A un usuario activo no le cierra
 * nada: lo regresa al inicio.
 *
 * El Location es relativo: en una ruta, request.nextUrl puede traer
 * "localhost" aunque se haya entrado por 127.0.0.1, y cada host tiene sus
 * propias cookies.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) return rechazo;

  const sesion = await resolverSesion();
  if (sesion.tipo === "activo") return redireccion("/");
  if (sesion.tipo === "sin_sesion") return redireccion(RUTA_ACCESO);

  const cliente = await crearClienteServidor();
  await cliente.auth.signOut();

  const respuesta = redireccion(`${RUTA_ACCESO}?aviso=inactivo`);
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-")) respuesta.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return respuesta;
}

function redireccion(destino: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { location: destino, "cache-control": "no-store" } });
}
