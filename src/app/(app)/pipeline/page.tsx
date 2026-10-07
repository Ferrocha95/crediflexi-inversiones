import type { Metadata } from "next";
import { connection } from "next/server";
import { fechaIsoEnMexico } from "../../../aplicacion/fecha";
import { aplicarFiltros, contarPorEstatus, leerFiltros, type ParametrosUrl, type ProspectoFila } from "../../../aplicacion/pipeline/filtros";
import { rangoSemanaEnTexto, semanaActual, semanaDe, semanasRecientes } from "../../../aplicacion/pipeline/semana";
import { filaParaPantalla } from "../../../aplicacion/pipeline/vista";
import { Aviso } from "../../../componentes/ui/Aviso";
import { contarArchivados, ejecutivosVisibles, listarProspectos, MENSAJE_ERROR_LECTURA_PIPELINE, type EjecutivoVisible } from "../../../servidor/pipeline/consultas";
import { exigirUsuario } from "../../../servidor/sesion";
import { crearClienteServidor } from "../../../servidor/supabase/servidor";
import { Pipeline } from "./Pipeline";
import { TEXTOS } from "./textosPantalla";

export const metadata: Metadata = {
  title: "Pipeline · Crediflexi Inversiones",
};

/** Semanas que ofrece el selector del encabezado del Excel. */
const SEMANAS_EN_SELECTOR = 8;

/**
 * Pipeline (componente de servidor). Lee con la sesión del usuario, así que
 * RLS decide qué prospectos ve; los filtros vienen de la URL y se aplican aquí,
 * sobre esas filas. Al navegador solo pasan textos ya formateados.
 */
export default async function PaginaPipeline({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  // Cada página revisa al usuario: el layout no se vuelve a ejecutar al navegar.
  const usuario = await exigirUsuario();
  // "Hoy" y la semana dependen de la hora de la petición.
  await connection();
  const filtros = leerFiltros(await searchParams);
  const ahora = new Date();
  const hoy = fechaIsoEnMexico(ahora);
  const superior = usuario.rol !== "EJECUTIVO";

  let activos: ProspectoFila[];
  let archivados: ProspectoFila[] = [];
  let ejecutivos: EjecutivoVisible[] = [];
  let totalArchivados = 0;
  try {
    const cliente = await crearClienteServidor();
    [activos, archivados, ejecutivos, totalArchivados] = await Promise.all([
      listarProspectos(cliente, { archivados: false }),
      filtros.archivados ? listarProspectos(cliente, { archivados: true }) : Promise.resolve([]),
      superior ? ejecutivosVisibles(cliente) : Promise.resolve([]),
      contarArchivados(cliente),
    ]);
  } catch {
    return (
      <div className="flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="text-4xl font-extrabold tracking-tight">{TEXTOS.tituloPagina}</h1>
        <Aviso role="alert" tono="error" titulo={TEXTOS.tituloError}>
          {MENSAJE_ERROR_LECTURA_PIPELINE}
        </Aviso>
      </div>
    );
  }

  const delEjecutivo = (filas: ProspectoFila[]) => (filtros.ejecutivo === null ? filas : filas.filter((f) => f.ejecutivoId === filtros.ejecutivo));
  const base = filtros.archivados ? archivados : activos;
  const filas = aplicarFiltros(base, filtros, hoy).map((f) => filaParaPantalla(f, hoy, usuario.id));

  const actual = semanaActual(ahora);
  const elegida = filtros.semana === null ? actual : semanaDe(filtros.semana);
  const opciones = semanasRecientes(actual, SEMANAS_EN_SELECTOR);
  if (!opciones.some((s) => s.lunes === elegida.lunes)) opciones.push(elegida);
  const conTexto = (s: { lunes: string; viernes: string }) => ({ lunes: s.lunes, texto: rangoSemanaEnTexto(s) });

  return (
    <div className="flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <Pipeline
        filtros={filtros}
        filas={filas}
        totalSinFiltrar={base.length}
        totalArchivados={totalArchivados}
        conteo={contarPorEstatus(delEjecutivo(activos))}
        superior={superior}
        ejecutivos={ejecutivos}
        semanas={opciones.map(conTexto)}
        semanaElegida={conTexto(elegida)}
        contexto={{ hoy, activos: activos.map((a) => ({ id: a.id, nombre: a.nombre, contacto: a.contacto })) }}
      />
    </div>
  );
}
