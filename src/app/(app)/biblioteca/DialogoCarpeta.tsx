"use client";

import { FolderPlus } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { LARGO_NOMBRE_CARPETA, type Categoria, type ErroresBiblioteca } from "../../../aplicacion/biblioteca/reglas";
import type { TextosBiblioteca } from "../../../aplicacion/textos";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { crearCarpeta } from "./acciones";

/**
 * Nueva subcarpeta en una sección (solo Director regional y Gerente), con la
 * acción crearCarpeta. La sección la fija el botón que abrió el diálogo. El
 * nombre no se puede cambiar después.
 */
export function DialogoCarpeta({
  categoria,
  textos,
  alCerrar,
  alCrear,
  alSesionExpirada,
}: {
  /** null: cerrado. */
  readonly categoria: Categoria | null;
  readonly textos: TextosBiblioteca;
  readonly alCerrar: () => void;
  readonly alCrear: () => void;
  readonly alSesionExpirada: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [errores, setErrores] = useState<ErroresBiblioteca>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function limpiar() {
    setNombre("");
    setErrores({});
    setError(null);
  }

  function cerrar() {
    if (ocupado) return;
    limpiar();
    alCerrar();
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (categoria === null) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await crearCarpeta({ categoria, nombre });
        if (r.ok) {
          limpiar();
          alCrear();
          return;
        }
        if (r.mensaje === MENSAJE_SESION_EXPIRADA) alSesionExpirada();
        setErrores(r.errores);
        setError(r.mensaje);
      } catch (err) {
        if (errorEsSesionExpirada(err)) alSesionExpirada();
        setError(errorEsSesionExpirada(err) ? MENSAJE_SESION_EXPIRADA : textos.fallaRed);
      }
    });
  }

  const describe = ["carpeta-nombre-ayuda", errores.nombre !== undefined ? "carpeta-nombre-error" : null].filter(Boolean).join(" ");

  return (
    <Dialogo
      abierto={categoria !== null}
      alCerrar={cerrar}
      titulo={textos.nuevaCarpeta}
      etiquetaCerrar={textos.cerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={ocupado}>
            {textos.cancelar}
          </Boton>
          <Boton type="submit" form="form-carpeta" cargando={ocupado} icono={<FolderPlus aria-hidden="true" className="size-5" />}>
            {textos.crear}
          </Boton>
        </>
      }
    >
      <form id="form-carpeta" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {error !== null && (
          <Aviso role="alert" tono="error" titulo={textos.tituloError}>
            {error}
          </Aviso>
        )}

        <p className="text-blanco">
          <span className="text-hielo-tenue">{textos.etiquetaSeccion}: </span>
          <strong>{categoria === null ? "" : textos.categorias[categoria]}</strong>
        </p>

        <Campo id="carpeta-nombre" etiqueta={textos.campoNombreCarpeta} ayuda={textos.ayudaNombreCarpeta} error={errores.nombre}>
          <Entrada
            id="carpeta-nombre"
            value={nombre}
            maxLength={LARGO_NOMBRE_CARPETA}
            autoComplete="off"
            onChange={(e) => setNombre(e.target.value)}
            aria-describedby={describe}
            aria-invalid={errores.nombre !== undefined || undefined}
          />
        </Campo>
      </form>
    </Dialogo>
  );
}
