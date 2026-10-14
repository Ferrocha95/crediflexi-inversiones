import { MENSAJES_BIBLIOTECA, TIPOS, extensionDeRuta } from "../../../../../aplicacion/biblioteca/reglas";
import { MENSAJE_SESION_EXPIRADA } from "../../../../../componentes/acceso/textos";
import { firmarDescarga, leerElemento } from "../../../../../servidor/biblioteca/consultas";
import { rechazoPorHost } from "../../../../../servidor/guardiaHost";
import { usuarioActual } from "../../../../../servidor/sesion";
import { crearClienteServidor } from "../../../../../servidor/supabase/servidor";

/**
 * GET /biblioteca/[id]/archivo[?modo=ver]: entrega un archivo de la Biblioteca.
 *
 * Lee la fila con la sesión del usuario (RLS decide si la ve), crea en el
 * servidor una URL firmada de vida corta (pasa por la política de lectura del
 * bucket) y reenvía los bytes en stream, sin guardarlos en memoria. La URL
 * firmada nunca llega al navegador. Los encabezados son propios, no los del
 * almacenamiento: tipo exacto de la fila, nosniff, sin caché y adjunto; en
 * línea solo con ?modo=ver y solo imagen, MP4, WEBM y PDF. Reenvía un Range
 * simple (para adelantar los videos).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANGO_SIMPLE = /^bytes=(\d+-\d*|-\d+)$/;

// Nada se ejecuta dentro del archivo: ni scripts ni formularios ni navegación.
const CSP_SANDBOX = "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";

const json = (status: number, mensaje: string) =>
  new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** Content-Disposition con un nombre ASCII simple y el nombre completo en filename* (RFC 6266). */
function disposicion(tipo: "inline" | "attachment", nombre: string): string {
  const simple = nombre.replace(/[^\x20-\x7e]|["\\/]/g, "_");
  const completo = encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${tipo}; filename="${simple}"; filename*=UTF-8''${completo}`;
}

export async function GET(request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) return rechazo;
  const usuario = await usuarioActual();
  if (usuario === null) return json(401, MENSAJE_SESION_EXPIRADA);

  const { id } = await contexto.params;
  if (!UUID.test(id)) return json(404, MENSAJES_BIBLIOTECA.noEncontrado);

  const cliente = await crearClienteServidor();
  let elemento;
  try {
    elemento = await leerElemento(cliente, id);
  } catch {
    return json(500, MENSAJES_BIBLIOTECA.fallaLectura);
  }
  if (elemento === null || elemento.tipo !== "ARCHIVO" || elemento.ruta === null || elemento.tipo_mime === null) {
    return json(404, MENSAJES_BIBLIOTECA.noEncontrado);
  }
  const ext = extensionDeRuta(elemento.ruta);
  if (ext === null) return json(404, MENSAJES_BIBLIOTECA.noEncontrado);

  const firmada = await firmarDescarga(cliente, elemento.ruta);
  if (firmada === null) return json(404, MENSAJES_BIBLIOTECA.noEncontrado);

  const rango = request.headers.get("range");
  let origen: Response;
  try {
    origen = await fetch(firmada, {
      headers: rango !== null && RANGO_SIMPLE.test(rango) ? { range: rango } : {},
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    return json(404, MENSAJES_BIBLIOTECA.noEncontrado);
  }
  if (origen.status === 416) {
    await origen.body?.cancel();
    return new Response(null, { status: 416, headers: { "content-range": origen.headers.get("content-range") ?? "", "cache-control": "no-store" } });
  }
  if (origen.status !== 200 && origen.status !== 206) {
    await origen.body?.cancel();
    return json(404, MENSAJES_BIBLIOTECA.noEncontrado);
  }

  const enLinea = new URL(request.url).searchParams.get("modo") === "ver" && TIPOS[ext].previsualiza;
  const encabezados = new Headers({
    "content-type": elemento.tipo_mime,
    "content-disposition": disposicion(enLinea ? "inline" : "attachment", `${elemento.nombre}.${ext}`),
    "x-content-type-options": "nosniff",
    "cache-control": "private, no-store",
    "content-security-policy": CSP_SANDBOX,
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
  });
  for (const clave of ["content-length", "content-range", "accept-ranges"]) {
    const valor = origen.headers.get(clave);
    if (valor !== null) encabezados.set(clave, valor);
  }
  return new Response(origen.body, { status: origen.status, headers: encabezados });
}
