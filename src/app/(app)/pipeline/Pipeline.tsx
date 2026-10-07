"use client";

import { Archive, ArchiveRestore, Download, Pencil, Plus, Search, Upload } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContextoAvisos } from "../../../aplicacion/pipeline/avisos";
import { hrefPipeline, type Conteo, type Filtros } from "../../../aplicacion/pipeline/filtros";
import type { Estatus } from "../../../aplicacion/pipeline/normalizar";
import { tipoListaVacia, type FilaPantalla, type TipoListaVacia, type ValoresProspecto } from "../../../aplicacion/pipeline/vista";
import { AvisoSesionExpirada } from "../../../componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../componentes/ui/Campo";
import { Casilla } from "../../../componentes/ui/Casilla";
import { EstadoVacio } from "../../../componentes/ui/EstadoVacio";
import { useNotificar } from "../../../componentes/ui/Notificaciones";
import { Selector } from "../../../componentes/ui/Selector";
import { TablaPipeline, type FilaPipelineDatos } from "../../../componentes/vistas/TablaPipeline";
import { archivarProspecto, crearProspecto, editarProspecto, restaurarProspecto, type RespuestaPipeline } from "./acciones";
import { BarraEstatus } from "./BarraEstatus";
import { DialogoProspecto, VALORES_NUEVO } from "./DialogoProspecto";
import { TEXTOS } from "./textosPantalla";

export interface PropsPipeline {
  readonly filtros: Filtros;
  /** Filas ya filtradas y formateadas. */
  readonly filas: readonly FilaPantalla[];
  /** Cuántas filas había antes de filtrar (activos o archivados, según la vista). */
  readonly totalSinFiltrar: number;
  /** Archivados visibles, para no decir "Aún no tienes prospectos" cuando solo hay archivados. */
  readonly totalArchivados: number;
  readonly conteo: Conteo;
  readonly superior: boolean;
  readonly ejecutivos: readonly { readonly id: string; readonly nombre: string }[];
  readonly semanas: readonly { readonly lunes: string; readonly texto: string }[];
  readonly semanaElegida: { readonly lunes: string; readonly texto: string };
  readonly contexto: ContextoAvisos;
}

type Edicion = { readonly id: string | null; readonly valores: ValoresProspecto; readonly clave: number };

const ENLACE = "inline-flex min-h-11 items-center font-bold text-hielo underline underline-offset-4 hover:text-blanco";

/** Lo que se muestra cuando la lista no tiene filas. */
function ListaVacia({
  tipo,
  archivados,
  sinFiltros,
  verArchivados,
  alNuevo,
}: {
  readonly tipo: TipoListaVacia;
  readonly archivados: number;
  readonly sinFiltros: string;
  readonly verArchivados: string;
  readonly alNuevo: () => void;
}) {
  const nuevo = (
    <Boton onClick={alNuevo} icono={<Plus aria-hidden="true" className="size-5" />}>
      {TEXTOS.nuevoProspecto}
    </Boton>
  );
  switch (tipo) {
    case "sin_resultados":
      return (
        <EstadoVacio
          titulo={TEXTOS.sinResultadosTitulo}
          descripcion={TEXTOS.sinResultadosTexto}
          accion={
            <Link href={sinFiltros} className={ENLACE}>
              {TEXTOS.quitarFiltros}
            </Link>
          }
        />
      );
    case "solo_archivados":
      return (
        <EstadoVacio
          titulo={TEXTOS.soloArchivadosTitulo}
          descripcion={TEXTOS.soloArchivadosTexto(archivados)}
          accion={
            <div className="flex flex-wrap items-center gap-4">
              <Link href={verArchivados} className={ENLACE}>
                {TEXTOS.verLosArchivados}
              </Link>
              {nuevo}
            </div>
          }
        />
      );
    case "sin_archivados":
      return <EstadoVacio titulo={TEXTOS.sinArchivadosTitulo} descripcion={TEXTOS.sinArchivadosTexto} />;
    case "sin_prospectos":
      return <EstadoVacio titulo={TEXTOS.vacioTitulo} descripcion={TEXTOS.vacioTexto} accion={nuevo} />;
  }
}

/** "Solo seguimientos vencidos": cambia en cuanto se toca, sin esperar a que termine la navegación. */
function CasillaVencidos({ filtros }: { readonly filtros: Filtros }) {
  const router = useRouter();
  const [marcada, setMarcada] = useState(filtros.vencido);
  return (
    <Casilla
      etiqueta={TEXTOS.soloVencidos}
      checked={marcada}
      onChange={(e) => {
        setMarcada(e.target.checked);
        router.push(hrefPipeline(filtros, { vencido: e.target.checked }), { scroll: false });
      }}
    />
  );
}

/** Botón pequeño dentro de una fila pintada: texto y contorno de foco en marino. */
const BOTON_FILA =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-bold text-marino hover:bg-marino/10 focus-visible:outline-marino disabled:opacity-50";

export function Pipeline({ filtros, filas, totalSinFiltrar, totalArchivados, conteo, superior, ejecutivos, semanas, semanaElegida, contexto }: PropsPipeline) {
  const router = useRouter();
  const notificar = useNotificar();
  const [edicion, setEdicion] = useState<Edicion | null>(filtros.nuevo ? { id: null, valores: VALORES_NUEVO, clave: 0 } : null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const porId = new Map(filas.map((f) => [f.datos.id, f]));

  const abrirNuevo = () => setEdicion({ id: null, valores: VALORES_NUEVO, clave: Date.now() });
  const cerrar = () => {
    setEdicion(null);
    if (filtros.nuevo) router.replace(hrefPipeline(filtros), { scroll: false });
  };

  /** Llama a una acción y traduce la sesión expirada (respuesta o 401 del proxy) al aviso de la pantalla. */
  async function llamar(accion: () => Promise<RespuestaPipeline>): Promise<RespuestaPipeline> {
    try {
      const r = await accion();
      if (!r.ok && r.mensaje === MENSAJE_SESION_EXPIRADA) setSesionExpirada(true);
      return r;
    } catch (e) {
      if (errorEsSesionExpirada(e)) setSesionExpirada(true);
      return { ok: false, mensaje: errorEsSesionExpirada(e) ? MENSAJE_SESION_EXPIRADA : "No se pudo comunicar con el servidor. Revisa que la app siga abierta y vuelve a intentar.", errores: {} };
    }
  }

  function cambiarArchivo(id: string, archivar: boolean) {
    iniciar(async () => {
      const r = await llamar(() => (archivar ? archivarProspecto(id) : restaurarProspecto(id)));
      if (r.ok) {
        notificar(
          archivar
            ? { tono: "exito", titulo: TEXTOS.notificacionArchivado, texto: TEXTOS.textoArchivado }
            : { tono: "exito", titulo: TEXTOS.notificacionRestaurado },
        );
      } else {
        notificar({ tono: "error", titulo: TEXTOS.notificacionError, texto: r.mensaje });
      }
    });
  }

  const acciones = (fila: FilaPipelineDatos) => {
    const f = porId.get(fila.id);
    if (f === undefined || !f.propio) return <span className="text-sm font-semibold text-marino/80">{TEXTOS.soloLectura}</span>;
    if (f.archivado) {
      return (
        <button type="button" className={BOTON_FILA} disabled={ocupado} onClick={() => cambiarArchivo(fila.id, false)} aria-label={`${TEXTOS.restaurar} ${fila.nombre}`}>
          <ArchiveRestore aria-hidden="true" className="size-4" />
          {TEXTOS.restaurar}
        </button>
      );
    }
    return (
      <span className="flex flex-wrap gap-1 md:flex-col md:items-start md:gap-0">
        <button
          type="button"
          className={BOTON_FILA}
          onClick={() => setEdicion({ id: fila.id, valores: f.valores, clave: Date.now() })}
          aria-label={`${TEXTOS.editar} ${fila.nombre}`}
        >
          <Pencil aria-hidden="true" className="size-4" />
          {TEXTOS.editar}
        </button>
        <button type="button" className={BOTON_FILA} disabled={ocupado} onClick={() => cambiarArchivo(fila.id, true)} aria-label={`${TEXTOS.archivar} ${fila.nombre}`}>
          <Archive aria-hidden="true" className="size-4" />
          {TEXTOS.archivar}
        </button>
      </span>
    );
  };

  const hayFiltros = filtros.estatus !== null || filtros.q !== "" || filtros.vencido || filtros.ejecutivo !== null;
  const sinFiltros = hrefPipeline(filtros, { estatus: null, q: "", vencido: false, ejecutivo: null });
  const datos = filas.map((f) => f.datos);

  return (
    <div className="flex flex-col gap-6">
      {sesionExpirada && <AvisoSesionExpirada siguiente="/pipeline" />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-prose flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{TEXTOS.tituloPagina}</h1>
          <p className="text-lg text-hielo">{superior ? TEXTOS.introSuperior : TEXTOS.introEjecutivo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { texto: TEXTOS.importarExcel, Icono: Upload },
            { texto: TEXTOS.descargarExcel, Icono: Download },
          ].map(({ texto, Icono }) => (
            <Boton
              key={texto}
              variante="fantasma"
              aria-disabled="true"
              aria-label={`${texto}, ${TEXTOS.proximamente}`}
              className="cursor-not-allowed border border-hielo/20 text-hielo-tenue hover:bg-transparent"
              icono={<Icono aria-hidden="true" className="size-5" />}
            >
              {texto}
              <span className="rounded-full bg-hielo/10 px-2 py-0.5 text-xs font-semibold text-hielo">{TEXTOS.proximamente}</span>
            </Boton>
          ))}
          <Boton onClick={abrirNuevo} icono={<Plus aria-hidden="true" className="size-5" />}>
            {TEXTOS.nuevoProspecto}
          </Boton>
        </div>
      </header>

      <BarraEstatus conteo={conteo} activo={filtros.estatus} hrefDe={(e: Estatus | null) => hrefPipeline(filtros, { estatus: e })} />

      <section aria-label="Filtros" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4 [&>*]:min-w-0">
          <Form action="/pipeline" className="flex min-w-[min(100%,20rem)] flex-1 basis-80 flex-col gap-1.5">
            {filtros.estatus !== null && <input type="hidden" name="estatus" value={filtros.estatus} />}
            {filtros.vencido && <input type="hidden" name="vencido" value="1" />}
            {filtros.ejecutivo !== null && <input type="hidden" name="ejecutivo" value={filtros.ejecutivo} />}
            {filtros.semana !== null && <input type="hidden" name="semana" value={filtros.semana} />}
            {filtros.archivados && <input type="hidden" name="archivados" value="1" />}
            <Campo id="buscar-prospecto" etiqueta={TEXTOS.buscar} ayuda={TEXTOS.ayudaBuscar}>
              <div className="flex gap-2">
                <Entrada id="buscar-prospecto" name="q" type="search" defaultValue={filtros.q} aria-describedby="buscar-prospecto-ayuda" autoComplete="off" />
                <Boton type="submit" variante="secundario" icono={<Search aria-hidden="true" className="size-5" />}>
                  {TEXTOS.botonBuscar}
                </Boton>
              </div>
            </Campo>
          </Form>

          {superior && (
            <Campo id="filtro-ejecutivo" etiqueta={TEXTOS.ejecutivo} className="w-full sm:w-64">
              <Selector
                id="filtro-ejecutivo"
                value={filtros.ejecutivo ?? ""}
                onChange={(e) => router.push(hrefPipeline(filtros, { ejecutivo: e.target.value === "" ? null : e.target.value }), { scroll: false })}
              >
                <option value="">{TEXTOS.todoElEquipo}</option>
                {ejecutivos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
          )}

          <Campo id="semana-excel" etiqueta={TEXTOS.semanaExcel} ayuda={TEXTOS.ayudaSemana} className="w-full sm:w-[25rem]">
            <Selector
              id="semana-excel"
              value={semanaElegida.lunes}
              aria-describedby="semana-excel-ayuda"
              onChange={(e) => router.push(hrefPipeline(filtros, { semana: e.target.value }), { scroll: false })}
            >
              {semanas.map((s) => (
                <option key={s.lunes} value={s.lunes}>
                  {s.texto}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <nav aria-label={TEXTOS.vista} className="flex gap-1 rounded-xl border border-hielo/25 bg-marino/70 p-1">
            {[
              { texto: TEXTOS.verActivos, archivados: false },
              { texto: TEXTOS.verArchivados, archivados: true },
            ].map((v) => (
              <Link
                key={v.texto}
                href={hrefPipeline(filtros, { archivados: v.archivados })}
                aria-current={filtros.archivados === v.archivados ? "page" : undefined}
                className="flex min-h-11 items-center rounded-lg px-4 font-semibold text-hielo transition-colors duration-150 hover:bg-hielo/10 aria-[current=page]:bg-hielo aria-[current=page]:text-marino"
              >
                {v.texto}
              </Link>
            ))}
          </nav>
          {!filtros.archivados && (
            <CasillaVencidos key={String(filtros.vencido)} filtros={filtros} />
          )}
        </div>
      </section>

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-lista" className="text-2xl font-bold">
            {filtros.archivados ? TEXTOS.tituloListaArchivados : TEXTOS.tituloLista}
          </h2>
          <p className="text-hielo-tenue" role="status">
            {TEXTOS.mostrando(filas.length, totalSinFiltrar)}
            {hayFiltros && (
              <>
                {" · "}
                <Link href={sinFiltros} className="font-semibold text-hielo underline underline-offset-4 hover:text-blanco">
                  {TEXTOS.quitarFiltros}
                </Link>
              </>
            )}
          </p>
        </div>

        {filas.length > 0 ? (
          <TablaPipeline
            titulo={filtros.archivados ? TEXTOS.tituloListaArchivados : TEXTOS.tituloLista}
            filas={datos}
            mostrarEjecutivo={superior}
            acciones={acciones}
            etiquetaAcciones={TEXTOS.acciones}
          />
        ) : (
          <ListaVacia
            tipo={tipoListaVacia({ vistaArchivados: filtros.archivados, totalSinFiltrar, archivados: totalArchivados })}
            archivados={totalArchivados}
            sinFiltros={sinFiltros}
            verArchivados={hrefPipeline(filtros, { archivados: true })}
            alNuevo={abrirNuevo}
          />
        )}
      </section>

      {edicion !== null && (
        <DialogoProspecto
          key={edicion.clave}
          abierto
          id={edicion.id}
          iniciales={edicion.valores}
          contexto={contexto}
          guardar={(v) => llamar(() => (edicion.id === null ? crearProspecto(v) : editarProspecto(edicion.id, v)))}
          alCerrar={cerrar}
          alGuardar={(r) => {
            cerrar();
            notificar({ tono: "exito", titulo: TEXTOS.notificacionGuardado, texto: r.avisos.length > 0 ? r.avisos.join(" ") : undefined });
          }}
        />
      )}
    </div>
  );
}
