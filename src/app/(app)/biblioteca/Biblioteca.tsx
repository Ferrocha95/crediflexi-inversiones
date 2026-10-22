"use client";

import { Archive, Download, ExternalLink, Eye, FileText, Folder, FolderArchive, FolderInput, FolderPlus, Inbox, Link2, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import type { Categoria } from "../../../aplicacion/biblioteca/reglas";
import {
  agruparPorCategoriaYCarpeta,
  normalizarBusqueda,
  queMostrar,
  type CarpetaPantalla,
  type ElementoPantalla,
  type GrupoCarpeta,
} from "../../../aplicacion/biblioteca/vista";
import type { TextosBiblioteca } from "../../../aplicacion/textos";
import { AvisoSesionExpirada } from "../../../componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { EstadoVacio } from "../../../componentes/ui/EstadoVacio";
import { useNotificar } from "../../../componentes/ui/Notificaciones";
import { archivar, archivarCarpeta } from "./acciones";
import { DialogoCarpeta } from "./DialogoCarpeta";
import { DialogoEnlace } from "./DialogoEnlace";
import { DialogoMover } from "./DialogoMover";
import { DialogoSubir } from "./DialogoSubir";

const BOTON_ELEMENTO =
  "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold text-hielo transition-colors duration-150 hover:bg-hielo/10 focus-visible:bg-hielo/10 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";

/** Clave de "Sin carpeta" de una sección, para recordar si está abierta. */
const claveSinCarpeta = (categoria: Categoria) => `sin:${categoria}`;

type Respuesta = { readonly ok: true } | { readonly ok: false; readonly mensaje: string };

/**
 * Pantalla de la Biblioteca: 4 secciones fijas y, en cada una, "Sin carpeta" y
 * sus subcarpetas como grupos que se abren y cierran (<details>, con teclado),
 * con su número de elementos. Búsqueda por nombre en todas las carpetas (sin
 * distinguir mayúsculas ni acentos). Director regional y Gerente además suben,
 * agregan enlaces, crean y archivan carpetas, mueven elementos, archivan y ven
 * lo archivado. Un ejecutivo no ve esos botones (y el servidor y RLS tampoco
 * lo dejarían).
 */
export function Biblioteca({
  textos,
  elementos,
  carpetas,
  administra,
}: {
  readonly textos: TextosBiblioteca;
  readonly elementos: readonly ElementoPantalla[];
  readonly carpetas: readonly CarpetaPantalla[];
  readonly administra: boolean;
}) {
  const router = useRouter();
  const notificar = useNotificar();
  const idBuscar = useId();
  const [busqueda, setBusqueda] = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [dialogo, setDialogo] = useState<"subir" | "enlace" | null>(null);
  const [porArchivar, setPorArchivar] = useState<ElementoPantalla | null>(null);
  const [nuevaCarpetaEn, setNuevaCarpetaEn] = useState<Categoria | null>(null);
  const [carpetaPorArchivar, setCarpetaPorArchivar] = useState<CarpetaPantalla | null>(null);
  const [porMover, setPorMover] = useState<ElementoPantalla | null>(null);
  const [abiertos, setAbiertos] = useState<Readonly<Record<string, boolean>>>({});
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const archivados = administra && verArchivados;
  const carpetasActivas = carpetas.filter((c) => !c.archivada);
  const delModo = elementos.filter((e) => e.archivado === archivados);
  const grupos = agruparPorCategoriaYCarpeta(elementos, carpetas, { archivados, busqueda });
  const buscando = normalizarBusqueda(busqueda) !== "";
  const hayResultados = grupos.some((g) => g.sinCarpeta.length > 0 || g.carpetas.some((c) => c.elementos.length > 0));
  const vacia = delModo.length === 0 && (archivados || carpetasActivas.length === 0);
  // Vacía: el aviso; Director y Gerente ven además las secciones para crear la primera carpeta.
  const mostrar = queMostrar({ vacia, administra, archivados });

  /** Abierto si se está buscando; si no, lo que eligió la persona ("Sin carpeta" empieza abierta). */
  const estaAbierto = (clave: string) => buscando || (abiertos[clave] ?? clave.startsWith("sin:"));
  const alternar = (clave: string, abierto: boolean) => {
    if (!buscando && abierto !== estaAbierto(clave)) setAbiertos((a) => ({ ...a, [clave]: abierto }));
  };

  /** Corre una acción de confirmación y avisa el resultado. */
  function confirmar(accion: () => Promise<Respuesta>, cerrar: () => void, titulo: string, texto: string) {
    iniciar(async () => {
      try {
        const r = await accion();
        cerrar();
        if (r.ok) {
          notificar({ tono: "exito", titulo, texto });
          router.refresh();
          return;
        }
        if (r.mensaje === MENSAJE_SESION_EXPIRADA) setSesionExpirada(true);
        notificar({ tono: "error", titulo: textos.tituloError, texto: r.mensaje });
      } catch (e) {
        cerrar();
        if (errorEsSesionExpirada(e)) setSesionExpirada(true);
        notificar({ tono: "error", titulo: textos.tituloError, texto: errorEsSesionExpirada(e) ? MENSAJE_SESION_EXPIRADA : textos.fallaRed });
      }
    });
  }

  function confirmarArchivo() {
    if (porArchivar === null) return;
    const elemento = porArchivar;
    confirmar(() => archivar(elemento.id), () => setPorArchivar(null), textos.notificacionArchivado, elemento.nombre);
  }

  function confirmarArchivoCarpeta() {
    if (carpetaPorArchivar === null) return;
    const carpeta = carpetaPorArchivar;
    confirmar(() => archivarCarpeta(carpeta.id), () => setCarpetaPorArchivar(null), textos.notificacionCarpetaArchivada, carpeta.nombre);
  }

  const alGuardar = (titulo: string, cerrar: () => void) => {
    cerrar();
    notificar({ tono: "exito", titulo });
    router.refresh();
  };

  const tarjetas = (lista: readonly ElementoPantalla[]) => (
    <ul className="grid gap-3 lg:grid-cols-2">
      {lista.map((e) => (
        <li key={e.id}>
          <Tarjeta
            elemento={e}
            textos={textos}
            administra={administra}
            puedeMover={!e.archivado && (e.carpetaId !== null || carpetasActivas.some((c) => c.categoria === e.categoria))}
            alArchivar={() => setPorArchivar(e)}
            alMover={() => setPorMover(e)}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      {sesionExpirada && <AvisoSesionExpirada siguiente="/biblioteca" />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-prose flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{verArchivados ? textos.tituloArchivados : textos.tituloPagina}</h1>
          <p className="text-lg text-hielo">{verArchivados ? textos.introArchivados : textos.intro}</p>
        </div>
        {administra && (
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => setVerArchivados((v) => !v)} icono={<Archive aria-hidden="true" className="size-5" />}>
              {verArchivados ? textos.verActivos : textos.verArchivados}
            </Boton>
            {!verArchivados && (
              <>
                <Boton variante="secundario" onClick={() => setDialogo("enlace")} icono={<Link2 aria-hidden="true" className="size-5" />}>
                  {textos.agregarEnlace}
                </Boton>
                <Boton onClick={() => setDialogo("subir")} icono={<Upload aria-hidden="true" className="size-5" />}>
                  {textos.subirArchivo}
                </Boton>
              </>
            )}
          </div>
        )}
      </header>

      <Campo id={idBuscar} etiqueta={textos.buscar} ayuda={textos.ayudaBuscar} className="max-w-md">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-hielo-tenue" />
          <Entrada
            id={idBuscar}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-describedby={`${idBuscar}-ayuda`}
            autoComplete="off"
            className="pl-10"
          />
        </div>
      </Campo>

      {mostrar.aviso && (
        <EstadoVacio
          titulo={verArchivados ? textos.sinArchivados : textos.bibliotecaVacia}
          descripcion={verArchivados ? undefined : administra ? textos.bibliotecaVaciaAdministrador : textos.bibliotecaVaciaEjecutivo}
        />
      )}
      {!mostrar.secciones ? null : buscando && !hayResultados ? (
        <p role="status" className="text-lg text-hielo">
          {textos.sinResultados}
        </p>
      ) : (
        grupos.map((grupo) => {
          const conAlgo = grupo.sinCarpeta.length > 0 || grupo.carpetas.length > 0;
          if (buscando && !conAlgo) return null;
          const idTitulo = `categoria-${grupo.categoria}`;
          return (
            <section key={grupo.categoria} aria-labelledby={idTitulo} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={idTitulo} className="text-2xl font-bold">
                  {textos.categorias[grupo.categoria]}
                </h2>
                {administra && !archivados && (
                  <button type="button" className={BOTON_ELEMENTO} onClick={() => setNuevaCarpetaEn(grupo.categoria)}>
                    <FolderPlus aria-hidden="true" className="size-4" />
                    {textos.nuevaCarpeta}
                    <span className="sr-only"> {textos.categorias[grupo.categoria]}</span>
                  </button>
                )}
              </div>

              {!conAlgo ? (
                <p className="text-hielo-tenue">{textos.categoriaVacia}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(!buscando || grupo.sinCarpeta.length > 0) && (
                    <Grupo
                      abierto={estaAbierto(claveSinCarpeta(grupo.categoria))}
                      alAlternar={(v) => alternar(claveSinCarpeta(grupo.categoria), v)}
                      icono={<Inbox aria-hidden="true" className="size-5 shrink-0" />}
                      titulo={textos.sinCarpeta}
                      numero={grupo.sinCarpeta.length}
                      textos={textos}
                    >
                      {grupo.sinCarpeta.length === 0 ? <p className="text-hielo-tenue">{textos.sinCarpetaVacio}</p> : tarjetas(grupo.sinCarpeta)}
                    </Grupo>
                  )}
                  {grupo.carpetas.map((g) => (
                    <GrupoDeCarpeta
                      key={g.carpeta.id}
                      grupo={g}
                      textos={textos}
                      abierto={estaAbierto(g.carpeta.id)}
                      alAlternar={(v) => alternar(g.carpeta.id, v)}
                      administra={administra && !archivados}
                      alArchivar={() => setCarpetaPorArchivar(g.carpeta)}
                    >
                      {g.elementos.length === 0 ? <p className="text-hielo-tenue">{textos.carpetaVacia}</p> : tarjetas(g.elementos)}
                    </GrupoDeCarpeta>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {administra && (
        <>
          <DialogoSubir
            abierto={dialogo === "subir"}
            carpetas={carpetasActivas}
            textos={textos}
            alCerrar={() => setDialogo(null)}
            alSubir={() => alGuardar(textos.notificacionSubido, () => setDialogo(null))}
            alSesionExpirada={() => setSesionExpirada(true)}
          />
          <DialogoEnlace
            abierto={dialogo === "enlace"}
            carpetas={carpetasActivas}
            textos={textos}
            alCerrar={() => setDialogo(null)}
            alAgregar={() => alGuardar(textos.notificacionEnlace, () => setDialogo(null))}
            alSesionExpirada={() => setSesionExpirada(true)}
          />
          <DialogoCarpeta
            categoria={nuevaCarpetaEn}
            textos={textos}
            alCerrar={() => setNuevaCarpetaEn(null)}
            alCrear={() => alGuardar(textos.notificacionCarpetaCreada, () => setNuevaCarpetaEn(null))}
            alSesionExpirada={() => setSesionExpirada(true)}
          />
          <DialogoMover
            elemento={porMover}
            carpetas={carpetasActivas}
            textos={textos}
            alCerrar={() => setPorMover(null)}
            alMover={() => alGuardar(textos.notificacionMovido, () => setPorMover(null))}
            alSesionExpirada={() => setSesionExpirada(true)}
          />
          <Dialogo
            abierto={porArchivar !== null}
            alCerrar={() => setPorArchivar(null)}
            titulo={textos.tituloArchivar}
            etiquetaCerrar={textos.cerrar}
            acciones={
              <>
                <Boton variante="secundario" onClick={() => setPorArchivar(null)} disabled={ocupado}>
                  {textos.cancelar}
                </Boton>
                <Boton onClick={confirmarArchivo} cargando={ocupado} icono={<Archive aria-hidden="true" className="size-5" />}>
                  {textos.archivar}
                </Boton>
              </>
            }
          >
            <p className="text-blanco">
              <strong>{porArchivar?.nombre}</strong>
            </p>
            <p className="mt-2 text-hielo">{textos.textoArchivar}</p>
          </Dialogo>
          <Dialogo
            abierto={carpetaPorArchivar !== null}
            alCerrar={() => setCarpetaPorArchivar(null)}
            titulo={textos.tituloArchivarCarpeta}
            etiquetaCerrar={textos.cerrar}
            acciones={
              <>
                <Boton variante="secundario" onClick={() => setCarpetaPorArchivar(null)} disabled={ocupado}>
                  {textos.cancelar}
                </Boton>
                <Boton onClick={confirmarArchivoCarpeta} cargando={ocupado} icono={<FolderArchive aria-hidden="true" className="size-5" />}>
                  {textos.archivarCarpeta}
                </Boton>
              </>
            }
          >
            <p className="text-blanco">
              <strong className="break-words">{carpetaPorArchivar?.nombre}</strong>
            </p>
            <p className="mt-2 text-hielo">{textos.textoArchivarCarpeta}</p>
          </Dialogo>
        </>
      )}
    </div>
  );
}

/** Grupo que se abre y se cierra con <details>: Enter o Espacio sobre el resumen, sin código extra. */
function Grupo({
  abierto,
  alAlternar,
  icono,
  titulo,
  insignia,
  numero,
  textos,
  children,
}: {
  readonly abierto: boolean;
  readonly alAlternar: (abierto: boolean) => void;
  readonly icono: ReactNode;
  readonly titulo: string;
  readonly insignia?: string;
  readonly numero: number;
  readonly textos: TextosBiblioteca;
  readonly children: ReactNode;
}) {
  return (
    <details
      open={abierto}
      onToggle={(e) => alAlternar(e.currentTarget.open)}
      className="group rounded-2xl border border-hielo/20 bg-marino/20"
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-lg font-bold text-blanco hover:bg-hielo/5">
        {icono}
        <span className="min-w-0 break-words">{titulo}</span>
        {insignia !== undefined && (
          <span className="rounded-full border border-hielo/30 px-2 py-0.5 text-xs font-semibold text-hielo">{insignia}</span>
        )}
        <span className="ml-auto rounded-full bg-hielo/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-hielo">
          <span className="sr-only">{textos.etiquetaNumeroElementos} </span>
          {numero}
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4">{children}</div>
    </details>
  );
}

function GrupoDeCarpeta({
  grupo,
  textos,
  abierto,
  alAlternar,
  administra,
  alArchivar,
  children,
}: {
  readonly grupo: GrupoCarpeta;
  readonly textos: TextosBiblioteca;
  readonly abierto: boolean;
  readonly alAlternar: (abierto: boolean) => void;
  /** Director o Gerente, y fuera de "Ver archivados". */
  readonly administra: boolean;
  readonly alArchivar: () => void;
  readonly children: ReactNode;
}) {
  const idExplicacion = useId();
  const conElementos = grupo.activos > 0;
  return (
    <Grupo
      abierto={abierto}
      alAlternar={alAlternar}
      icono={<Folder aria-hidden="true" className="size-5 shrink-0" />}
      titulo={grupo.carpeta.nombre}
      insignia={grupo.carpeta.archivada ? textos.etiquetaCarpetaArchivada : undefined}
      numero={grupo.elementos.length}
      textos={textos}
    >
      {administra && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BOTON_ELEMENTO}
            onClick={alArchivar}
            disabled={conElementos}
            aria-describedby={conElementos ? idExplicacion : undefined}
          >
            <FolderArchive aria-hidden="true" className="size-4" />
            {textos.archivarCarpeta}
            <span className="sr-only"> {grupo.carpeta.nombre}</span>
          </button>
          {conElementos && (
            <p id={idExplicacion} className="text-sm text-hielo-tenue">
              {textos.explicacionCarpetaNoVacia}
            </p>
          )}
        </div>
      )}
      {children}
    </Grupo>
  );
}

function Tarjeta({
  elemento: e,
  textos,
  administra,
  puedeMover,
  alArchivar,
  alMover,
}: {
  readonly elemento: ElementoPantalla;
  readonly textos: TextosBiblioteca;
  readonly administra: boolean;
  readonly puedeMover: boolean;
  readonly alArchivar: () => void;
  readonly alMover: () => void;
}) {
  const archivo = `/biblioteca/${e.id}/archivo`;
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-hielo/20 bg-marino/40 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-hielo/10 text-hielo">
          {e.esEnlace ? <Link2 aria-hidden="true" className="size-5" /> : <FileText aria-hidden="true" className="size-5" />}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-bold break-words text-blanco">{e.nombre}</h3>
          {e.descripcion !== "" && <p className="break-words whitespace-pre-line text-hielo">{e.descripcion}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-hielo-tenue">{textos.etiquetaTipo}</dt>
        <dd className="text-blanco">{e.tipo}</dd>
        {e.tamano !== null && (
          <>
            <dt className="text-hielo-tenue">{textos.etiquetaTamano}</dt>
            <dd className="text-blanco">{e.tamano}</dd>
          </>
        )}
        <dt className="text-hielo-tenue">{textos.etiquetaFecha}</dt>
        <dd className="text-blanco">{e.fecha}</dd>
        <dt className="text-hielo-tenue">{textos.etiquetaSubidoPor}</dt>
        <dd className="break-words text-blanco">{e.subidoPor}</dd>
        {e.dominio !== null && (
          <>
            <dt className="text-hielo-tenue">{textos.campoEnlace}</dt>
            <dd className="break-all text-blanco">{e.dominio}</dd>
          </>
        )}
      </dl>

      <div className="mt-auto flex flex-wrap gap-1">
        {e.esEnlace && e.enlace !== null ? (
          <a href={e.enlace} target="_blank" rel="noopener noreferrer" className={BOTON_ELEMENTO}>
            <ExternalLink aria-hidden="true" className="size-4" />
            {textos.abrirEnlace}
            <span className="sr-only">
              {" "}
              {e.nombre}, {e.dominio} {textos.nuevaPestana}
            </span>
          </a>
        ) : (
          <>
            {e.previsualiza && (
              <a href={`${archivo}?modo=ver`} target="_blank" rel="noopener noreferrer" className={BOTON_ELEMENTO}>
                <Eye aria-hidden="true" className="size-4" />
                {textos.ver}
                <span className="sr-only">
                  {" "}
                  {e.nombre} {textos.nuevaPestana}
                </span>
              </a>
            )}
            <a href={archivo} className={BOTON_ELEMENTO}>
              <Download aria-hidden="true" className="size-4" />
              {textos.descargar}
              <span className="sr-only"> {e.nombre}</span>
            </a>
          </>
        )}
        {administra && puedeMover && (
          <button type="button" className={BOTON_ELEMENTO} onClick={alMover}>
            <FolderInput aria-hidden="true" className="size-4" />
            {textos.moverA}
            <span className="sr-only"> {e.nombre}</span>
          </button>
        )}
        {administra && !e.archivado && (
          <button type="button" className={BOTON_ELEMENTO} onClick={alArchivar}>
            <Archive aria-hidden="true" className="size-4" />
            {textos.archivar}
            <span className="sr-only"> {e.nombre}</span>
          </button>
        )}
      </div>
    </article>
  );
}
