import { MENSAJES_ARCHIVO, MENSAJES_EXCEL, TOPES_IMPORTACION } from "../../../../aplicacion/excel/archivo";
import { fechaIsoEnMexico } from "../../../../aplicacion/fecha";
import { MENSAJE_SESION_EXPIRADA } from "../../../../componentes/acceso/textos";
import { analizarArchivo } from "../../../../servidor/excel/importar";
import { rechazoPorHost } from "../../../../servidor/guardiaHost";
import { listarProspectos } from "../../../../servidor/pipeline/consultas";
import { usuarioActual } from "../../../../servidor/sesion";
import { crearClienteServidor } from "../../../../servidor/supabase/servidor";

/** Segundos máximos de la función en Vercel (genera un PDF o un Excel). */
export const maxDuration = 60;

/**
 * POST /pipeline/importar: vista previa de un .xlsx. El cuerpo es el archivo
 * tal cual (application/octet-stream) y su nombre va en el encabezado
 * x-nombre-archivo (codificado con encodeURIComponent). Se lee en memoria con
 * request.arrayBuffer() y nunca se escribe a disco. No guarda nada: guardar
 * es la acción confirmarImportacion, que vuelve a validar todo.
 *
 * Guardias: host permitido, Origin igual a Host, usuario activo y 4 MiB como tope
 * (content-length y bytes reales). Si hay content-length y no coincide con
 * lo leído, se rechaza: el proxy RECORTA lo que pasa de proxyClientMaxBodySize
 * (next.config.ts), no lo rechaza.
 */

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const error = (status: number, mensaje: string) => json(status, { error: mensaje });

/** El Origin es obligatorio y debe ser el mismo Host de la petición. */
function origenCoincide(origin: string | null, host: string): boolean {
  if (origin === null) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function nombreDelArchivo(request: Request): string {
  try {
    return decodeURIComponent(request.headers.get("x-nombre-archivo") ?? "");
  } catch {
    return "";
  }
}

export async function POST(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const rechazo = rechazoPorHost(host);
  if (rechazo !== null) return rechazo;
  if (!origenCoincide(request.headers.get("origin"), host!)) return error(403, MENSAJES_EXCEL.origenAjeno);
  const usuario = await usuarioActual();
  if (usuario === null) return error(401, MENSAJE_SESION_EXPIRADA);

  const declarado = request.headers.get("content-length");
  if (declarado !== null && (!/^[0-9]+$/.test(declarado) || Number(declarado) > TOPES_IMPORTACION.bytes)) {
    return error(413, MENSAJES_ARCHIVO.muyGrande);
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return error(400, MENSAJES_EXCEL.incompleto);
  }
  if (bytes.length > TOPES_IMPORTACION.bytes) return error(413, MENSAJES_ARCHIVO.muyGrande);
  if (declarado !== null && Number(declarado) !== bytes.length) return error(400, MENSAJES_EXCEL.incompleto);

  let activos;
  try {
    activos = await listarProspectos(await crearClienteServidor(), { archivados: false });
  } catch {
    return error(500, MENSAJES_EXCEL.fallaLectura);
  }

  const analisis = await analizarArchivo(bytes, nombreDelArchivo(request), {
    hoy: fechaIsoEnMexico(new Date()),
    usuario: { nombre: usuario.nombre },
    activos: activos.map((a) => ({ id: a.id, nombre: a.nombre, contacto: a.contacto })),
  });
  return analisis.ok ? json(200, analisis) : error(422, analisis.mensaje);
}
