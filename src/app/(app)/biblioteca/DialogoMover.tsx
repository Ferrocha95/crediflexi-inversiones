"use client";

import { FolderInput } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import type { CarpetaPantalla, ElementoPantalla } from "../../../aplicacion/biblioteca/vista";
import type { TextosBiblioteca } from "../../../aplicacion/textos";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { Selector } from "../../../componentes/ui/Selector";
import { moverElemento } from "./acciones";

const SIN_CARPETA = "";

/**
 * Mover un elemento a otra carpeta de su MISMA sección, o a Sin carpeta (solo
 * Director regional y Gerente), con la acción moverElemento. Solo se ofrecen
 * las carpetas activas de la sección del elemento; el servidor y la base lo
 * vuelven a revisar.
 */
export function DialogoMover({
  elemento,
  carpetas,
  textos,
  alCerrar,
  alMover,
  alSesionExpirada,
}: {
  /** null: cerrado. */
  readonly elemento: ElementoPantalla | null;
  readonly carpetas: readonly CarpetaPantalla[];
  readonly textos: TextosBiblioteca;
  readonly alCerrar: () => void;
  readonly alMover: () => void;
  readonly alSesionExpirada: () => void;
}) {
  const [destino, setDestino] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const opciones = elemento === null ? [] : carpetas.filter((c) => c.categoria === elemento.categoria && !c.archivada);
  // Por omisión, la primera opción distinta de donde está hoy.
  const actual = elemento?.carpetaId ?? SIN_CARPETA;
  const porOmision = [SIN_CARPETA, ...opciones.map((c) => c.id)].find((v) => v !== actual) ?? SIN_CARPETA;
  const elegido = destino ?? porOmision;

  function cerrar() {
    if (ocupado) return;
    setDestino(null);
    setError(null);
    alCerrar();
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (elemento === null) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await moverElemento({ id: elemento.id, carpeta_id: elegido === SIN_CARPETA ? null : elegido });
        if (r.ok) {
          setDestino(null);
          alMover();
          return;
        }
        if (r.mensaje === MENSAJE_SESION_EXPIRADA) alSesionExpirada();
        setError(r.mensaje);
      } catch (err) {
        if (errorEsSesionExpirada(err)) alSesionExpirada();
        setError(errorEsSesionExpirada(err) ? MENSAJE_SESION_EXPIRADA : textos.fallaRed);
      }
    });
  }

  return (
    <Dialogo
      abierto={elemento !== null}
      alCerrar={cerrar}
      titulo={textos.tituloMover}
      etiquetaCerrar={textos.cerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={ocupado}>
            {textos.cancelar}
          </Boton>
          <Boton
            type="submit"
            form="form-mover"
            cargando={ocupado}
            disabled={elegido === actual}
            icono={<FolderInput aria-hidden="true" className="size-5" />}
          >
            {textos.mover}
          </Boton>
        </>
      }
    >
      <form id="form-mover" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {error !== null && (
          <Aviso role="alert" tono="error" titulo={textos.tituloError}>
            {error}
          </Aviso>
        )}

        <p className="text-blanco">
          <strong className="break-words">{elemento?.nombre}</strong>
        </p>

        <Campo id="mover-carpeta" etiqueta={textos.campoCarpeta} ayuda={textos.ayudaCarpetaMover}>
          <Selector id="mover-carpeta" value={elegido} onChange={(e) => setDestino(e.target.value)} aria-describedby="mover-carpeta-ayuda">
            <option value={SIN_CARPETA} disabled={actual === SIN_CARPETA}>
              {textos.sinCarpeta}
            </option>
            {opciones.map((c) => (
              <option key={c.id} value={c.id} disabled={actual === c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      </form>
    </Dialogo>
  );
}
