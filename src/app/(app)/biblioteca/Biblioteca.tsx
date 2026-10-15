"use client";

import { Archive, Download, ExternalLink, Eye, FileText, Link2, Search, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { coincideBusqueda, agruparPorCategoria, type ElementoPantalla } from "../../../aplicacion/biblioteca/vista";
import type { TextosBiblioteca } from "../../../aplicacion/textos";
import { AvisoSesionExpirada } from "../../../componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { EstadoVacio } from "../../../componentes/ui/EstadoVacio";
import { useNotificar } from "../../../componentes/ui/Notificaciones";
import { archivar } from "./acciones";
import { DialogoEnlace } from "./DialogoEnlace";
import { DialogoSubir } from "./DialogoSubir";

const BOTON_ELEMENTO =
  "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold text-hielo transition-colors duration-150 hover:bg-hielo/10 focus-visible:bg-hielo/10";

/**
 * Pantalla de la Biblioteca: 4 categorías fijas, búsqueda por nombre (sin
 * distinguir mayúsculas ni acentos) y, para Director regional y Gerente,
 * subir, agregar enlaces, archivar y ver lo archivado. Un ejecutivo no ve esos
 * botones (y el servidor y RLS tampoco lo dejarían).
 */
export function Biblioteca({
  textos,
  elementos,
  administra,
}: {
  readonly textos: TextosBiblioteca;
  readonly elementos: readonly ElementoPantalla[];
  readonly administra: boolean;
}) {
  const router = useRouter();
  const notificar = useNotificar();
  const idBuscar = useId();
  const [busqueda, setBusqueda] = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [dialogo, setDialogo] = useState<"subir" | "enlace" | null>(null);
  const [porArchivar, setPorArchivar] = useState<ElementoPantalla | null>(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const delModo = elementos.filter((e) => e.archivado === (administra && verArchivados));
  const visibles = delModo.filter((e) => coincideBusqueda(e.nombre, busqueda));
  const grupos = agruparPorCategoria(visibles);
  const buscando = busqueda.trim() !== "";

  function confirmarArchivo() {
    if (porArchivar === null) return;
    const elemento = porArchivar;
    iniciar(async () => {
      try {
        const r = await archivar(elemento.id);
        if (r.ok) {
          setPorArchivar(null);
          notificar({ tono: "exito", titulo: textos.notificacionArchivado, texto: elemento.nombre });
          router.refresh();
          return;
        }
        if (r.mensaje === MENSAJE_SESION_EXPIRADA) setSesionExpirada(true);
        setPorArchivar(null);
        notificar({ tono: "error", titulo: textos.tituloError, texto: r.mensaje });
      } catch (e) {
        setPorArchivar(null);
        if (errorEsSesionExpirada(e)) setSesionExpirada(true);
        notificar({ tono: "error", titulo: textos.tituloError, texto: errorEsSesionExpirada(e) ? MENSAJE_SESION_EXPIRADA : textos.fallaRed });
      }
    });
  }

  const alGuardar = (titulo: string) => {
    setDialogo(null);
    notificar({ tono: "exito", titulo });
    router.refresh();
  };

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

      {delModo.length === 0 ? (
        <EstadoVacio
          titulo={verArchivados ? textos.sinArchivados : textos.bibliotecaVacia}
          descripcion={verArchivados ? undefined : administra ? textos.bibliotecaVaciaAdministrador : textos.bibliotecaVaciaEjecutivo}
        />
      ) : buscando && visibles.length === 0 ? (
        <p role="status" className="text-lg text-hielo">
          {textos.sinResultados}
        </p>
      ) : (
        grupos.map((grupo) =>
          buscando && grupo.elementos.length === 0 ? null : (
            <section key={grupo.categoria} aria-labelledby={`categoria-${grupo.categoria}`} className="flex flex-col gap-3">
              <h2 id={`categoria-${grupo.categoria}`} className="text-2xl font-bold">
                {textos.categorias[grupo.categoria]}
              </h2>
              {grupo.elementos.length === 0 ? (
                <p className="text-hielo-tenue">{textos.categoriaVacia}</p>
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {grupo.elementos.map((e) => (
                    <li key={e.id}>
                      <Tarjeta elemento={e} textos={textos} administra={administra} alArchivar={() => setPorArchivar(e)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ),
        )
      )}

      {administra && (
        <>
          <DialogoSubir
            abierto={dialogo === "subir"}
            textos={textos}
            alCerrar={() => setDialogo(null)}
            alSubir={() => alGuardar(textos.notificacionSubido)}
            alSesionExpirada={() => setSesionExpirada(true)}
          />
          <DialogoEnlace
            abierto={dialogo === "enlace"}
            textos={textos}
            alCerrar={() => setDialogo(null)}
            alAgregar={() => alGuardar(textos.notificacionEnlace)}
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
        </>
      )}
    </div>
  );
}

function Tarjeta({
  elemento: e,
  textos,
  administra,
  alArchivar,
}: {
  readonly elemento: ElementoPantalla;
  readonly textos: TextosBiblioteca;
  readonly administra: boolean;
  readonly alArchivar: () => void;
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
