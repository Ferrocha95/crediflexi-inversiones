import { randomUUID } from "node:crypto";
import {
  MENSAJES_BIBLIOTECA,
  TOPE_CUERPO,
  mensajeDeErrorBase,
  puedeAdministrar,
  sinExtension,
  validarMetadatos,
  type ErroresBiblioteca,
} from "../../../../aplicacion/biblioteca/reglas";
import { MENSAJE_SESION_EXPIRADA } from "../../../../componentes/acceso/textos";
import { validarArchivo } from "../../../../servidor/biblioteca/archivo";
import { carpetaDestino } from "../../../../servidor/biblioteca/carpetas";
import { insertarElemento, organizacionDelUsuario, subirObjeto } from "../../../../servidor/biblioteca/consultas";
import { leerConTope } from "../../../../servidor/biblioteca/cuerpo";
import { rechazoPorHost } from "../../../../servidor/guardiaHost";
import { usuarioActual } from "../../../../servidor/sesion";
import { crearClienteServidor } from "../../../../servidor/supabase/servidor";

/**
 * POST /biblioteca/subir: sube un archivo a la Biblioteca (solo Director
 * regional y Gerente). El cuerpo es un formulario multipart con archivo,
 * nombre, descripcion, categoria, confirmacion ("si") y carpeta (opcional: el
 * id de una carpeta activa de la misma sección; vacío es Sin carpeta).
 *
 * Esta ruta pasa por el proxy (guardia de host y refresco de sesión): con el
 * archivo topado en 4 MiB, el cuerpo cabe en proxyClientMaxBodySize (6 MB) y
 * el proxy no lo recorta. Aun así repite aquí, EN ESTE ORDEN y antes de leer
 * el cuerpo, como defensa en profundidad: guardia de host,
 * Origin igual a Host, usuario activo, rol Director o Gerente, tipo
 * multipart/form-data y content-length. Luego lee el cuerpo en stream con
 * contador y corta al pasar TOPE_CUERPO (archivo de 4 MiB más el margen del
 * formulario). El archivo se revisa por sus bytes reales (tipo, firma, tope de
 * 4,194,304 bytes y, en Office, el ZIP) y se guarda con un nombre generado
 * (uuid) y el tipo detectado, con la sesión del usuario.
 */

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const error = (status: number, mensaje: string, errores?: ErroresBiblioteca) =>
  json(status, errores === undefined ? { error: mensaje } : { error: mensaje, errores });

/** El Origin es obligatorio y debe ser el mismo Host de la petición. */
function origenCoincide(origin: string | null, host: string): boolean {
  if (origin === null) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/** multipart/form-data con boundary. */
function esMultipart(tipo: string | null): boolean {
  return tipo !== null && /^multipart\/form-data\s*;.*\bboundary=/i.test(tipo);
}

const texto = (valor: FormDataEntryValue | null): string | undefined => (typeof valor === "string" ? valor : undefined);

export async function POST(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const rechazo = rechazoPorHost(host);
  if (rechazo !== null) return rechazo;
  if (!origenCoincide(request.headers.get("origin"), host!)) return error(403, MENSAJES_BIBLIOTECA.origenAjeno);
  const usuario = await usuarioActual();
  if (usuario === null) return error(401, MENSAJE_SESION_EXPIRADA);
  if (!puedeAdministrar(usuario.rol)) return error(403, MENSAJES_BIBLIOTECA.soloDirectorOGerente);
  const tipo = request.headers.get("content-type");
  if (!esMultipart(tipo)) return error(415, MENSAJES_BIBLIOTECA.noEsFormulario);

  const declarado = request.headers.get("content-length");
  if (declarado !== null && !/^[0-9]+$/.test(declarado)) return error(400, MENSAJES_BIBLIOTECA.incompleto);
  if (declarado !== null && Number(declarado) > TOPE_CUERPO) return error(413, MENSAJES_BIBLIOTECA.muyGrande);

  const lectura = await leerConTope(request.body, TOPE_CUERPO);
  if (!lectura.ok) {
    return lectura.motivo === "grande" ? error(413, MENSAJES_BIBLIOTECA.muyGrande) : error(400, MENSAJES_BIBLIOTECA.incompleto);
  }
  if (declarado !== null && Number(declarado) !== lectura.bytes.length) return error(400, MENSAJES_BIBLIOTECA.incompleto);

  let formulario: FormData;
  try {
    formulario = await new Response(lectura.bytes as BodyInit, { headers: { "content-type": tipo! } }).formData();
  } catch {
    return error(400, MENSAJES_BIBLIOTECA.formularioIlegible);
  }

  if (formulario.get("confirmacion") !== "si") {
    return error(400, MENSAJES_BIBLIOTECA.sinConfirmacion, { confirmacion: MENSAJES_BIBLIOTECA.sinConfirmacion });
  }
  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File)) return error(400, MENSAJES_BIBLIOTECA.sinArchivo, { archivo: MENSAJES_BIBLIOTECA.sinArchivo });

  // Bytes reales del archivo: el tamaño y el tipo que declara el navegador no cuentan.
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const revision = validarArchivo(archivo.name, bytes);
  if (!revision.ok) return error(revision.muyGrande ? 413 : 400, revision.mensaje, { archivo: revision.mensaje });

  const nombre = texto(formulario.get("nombre"))?.trim() || sinExtension(revision.nombreLimpio);
  const metadatos = validarMetadatos({
    nombre,
    descripcion: texto(formulario.get("descripcion")) ?? "",
    categoria: texto(formulario.get("categoria")),
  });
  if (!metadatos.ok) {
    const primero = Object.values(metadatos.errores)[0] ?? MENSAJES_BIBLIOTECA.formaInvalida;
    return error(400, primero, metadatos.errores);
  }

  const cliente = await crearClienteServidor();
  // La carpeta se revisa antes de subir el objeto, para no dejarlo sin fila.
  const carpeta = await carpetaDestino(cliente, formulario.get("carpeta"), metadatos.valor.categoria);
  if (!carpeta.ok) return error(400, carpeta.mensaje, { carpeta: carpeta.mensaje });
  const organizacion = await organizacionDelUsuario(cliente);
  if (organizacion === null) return error(500, MENSAJES_BIBLIOTECA.fallaLectura);

  const ruta = `${organizacion}/${randomUUID()}.${revision.ext}`;
  if ((await subirObjeto(cliente, ruta, bytes, revision.mime)) !== null) return error(500, MENSAJES_BIBLIOTECA.fallaAlmacenamiento);

  // Si la fila falla, el objeto queda sin fila: nadie puede borrarlo (pendiente anotado).
  const guardado = await insertarElemento(cliente, {
    categoria: metadatos.valor.categoria,
    nombre: metadatos.valor.nombre,
    descripcion: metadatos.valor.descripcion,
    tipo: "ARCHIVO",
    ruta,
    tipo_mime: revision.mime,
    tamano_bytes: bytes.length,
    ...(carpeta.id === null ? {} : { carpeta_id: carpeta.id }),
  });
  if (!guardado.ok) {
    const traducido = mensajeDeErrorBase(guardado.error);
    return error(traducido.permisos ? 403 : traducido.datos ? 400 : 500, traducido.mensaje);
  }
  return json(201, { ok: true, id: guardado.id });
}
