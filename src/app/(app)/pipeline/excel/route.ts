import { MENSAJES_EXCEL, nombreArchivoPipeline, TIPO_XLSX } from "../../../../aplicacion/excel/archivo";
import { leerFiltros } from "../../../../aplicacion/pipeline/filtros";
import { semanaActual, semanaDe } from "../../../../aplicacion/pipeline/semana";
import { MENSAJE_SESION_EXPIRADA } from "../../../../componentes/acceso/textos";
import { exportarPipeline } from "../../../../servidor/excel/pipeline";
import { rechazoPorHost } from "../../../../servidor/guardiaHost";
import { ejecutivosVisibles, listarProspectos } from "../../../../servidor/pipeline/consultas";
import { usuarioActual } from "../../../../servidor/sesion";
import { crearClienteServidor } from "../../../../servidor/supabase/servidor";

/** Segundos máximos de la función en Vercel (genera un PDF o un Excel). */
export const maxDuration = 60;

/**
 * GET /pipeline/excel?semana=AAAA-MM-DD&ejecutivo=<id>: descarga
 * PIPELINE_{MES}.xlsx con los prospectos activos de UN ejecutivo. La semana
 * solo cambia el encabezado (D1:F2) y el mes del nombre del archivo.
 *
 * Repite el guardia de host, exige usuario activo y lee con la sesión del
 * usuario (RLS). Un ejecutivo descarga lo suyo; un superior debe elegir a un
 * ejecutivo que pueda ver.
 */

const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) return rechazo;
  const usuario = await usuarioActual();
  if (usuario === null) return json(401, MENSAJE_SESION_EXPIRADA);

  const filtros = leerFiltros(Object.fromEntries(new URL(request.url).searchParams));
  const semana = filtros.semana === null ? semanaActual(new Date()) : semanaDe(filtros.semana);

  try {
    const cliente = await crearClienteServidor();
    let ejecutivo: { readonly id: string; readonly nombre: string };
    if (usuario.rol === "EJECUTIVO") {
      if (filtros.ejecutivo !== null && filtros.ejecutivo !== usuario.id) return json(403, MENSAJES_EXCEL.soloElPropio);
      ejecutivo = { id: usuario.id, nombre: usuario.nombre };
    } else {
      if (filtros.ejecutivo === null) return json(400, MENSAJES_EXCEL.eligeEjecutivo);
      const visible = (await ejecutivosVisibles(cliente)).find((e) => e.id === filtros.ejecutivo);
      if (visible === undefined) return json(404, MENSAJES_EXCEL.ejecutivoNoVisible);
      ejecutivo = visible;
    }

    const filas = (await listarProspectos(cliente, { archivados: false })).filter((p) => p.ejecutivoId === ejecutivo.id);
    const archivo = await exportarPipeline({ filas, ejecutivo: ejecutivo.nombre, semana });
    return new Response(new Uint8Array(archivo), {
      headers: {
        "content-type": TIPO_XLSX,
        "content-disposition": `attachment; filename="${nombreArchivoPipeline(semana)}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return json(500, MENSAJES_EXCEL.fallaLectura);
  }
}
