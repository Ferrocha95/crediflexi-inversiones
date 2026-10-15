"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CATEGORIAS, MENSAJES_BIBLIOTECA, type ErroresBiblioteca } from "../../../aplicacion/biblioteca/reglas";
import type { TextosBiblioteca } from "../../../aplicacion/textos";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { AreaTexto, Campo, Entrada } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { Selector } from "../../../componentes/ui/Selector";
import { agregarEnlace } from "./acciones";

/** Agregar un enlace https (solo Director regional y Gerente), con la acción agregarEnlace. */
export function DialogoEnlace({
  abierto,
  textos,
  alCerrar,
  alAgregar,
  alSesionExpirada,
}: {
  readonly abierto: boolean;
  readonly textos: TextosBiblioteca;
  readonly alCerrar: () => void;
  readonly alAgregar: () => void;
  readonly alSesionExpirada: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [enlace, setEnlace] = useState("");
  const [errores, setErrores] = useState<ErroresBiblioteca>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function limpiar() {
    setNombre("");
    setDescripcion("");
    setCategoria("");
    setEnlace("");
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
    setError(null);
    if (categoria === "") {
      setErrores({ categoria: MENSAJES_BIBLIOTECA.categoriaInvalida });
      return;
    }
    iniciar(async () => {
      try {
        const r = await agregarEnlace({ nombre, descripcion, categoria, enlace });
        if (r.ok) {
          limpiar();
          alAgregar();
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

  const describe = (id: string, conAyuda: boolean, campo: keyof ErroresBiblioteca) =>
    [conAyuda ? `${id}-ayuda` : null, errores[campo] !== undefined ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={cerrar}
      titulo={textos.agregarEnlace}
      etiquetaCerrar={textos.cerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={ocupado}>
            {textos.cancelar}
          </Boton>
          <Boton type="submit" form="form-enlace" cargando={ocupado}>
            {textos.agregar}
          </Boton>
        </>
      }
    >
      <form id="form-enlace" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {error !== null && (
          <Aviso role="alert" tono="error" titulo={textos.tituloError}>
            {error}
          </Aviso>
        )}

        <Campo id="enlace-url" etiqueta={textos.campoEnlace} ayuda={textos.ayudaEnlace} error={errores.enlace}>
          <Entrada
            id="enlace-url"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={enlace}
            maxLength={500}
            onChange={(e) => setEnlace(e.target.value)}
            aria-describedby={describe("enlace-url", true, "enlace")}
            aria-invalid={errores.enlace !== undefined || undefined}
          />
        </Campo>

        <Campo id="enlace-nombre" etiqueta={textos.campoNombre} error={errores.nombre}>
          <Entrada
            id="enlace-nombre"
            value={nombre}
            maxLength={150}
            onChange={(e) => setNombre(e.target.value)}
            aria-describedby={describe("enlace-nombre", false, "nombre")}
            aria-invalid={errores.nombre !== undefined || undefined}
          />
        </Campo>

        <Campo id="enlace-descripcion" etiqueta={textos.campoDescripcion} error={errores.descripcion}>
          <AreaTexto
            id="enlace-descripcion"
            rows={3}
            value={descripcion}
            maxLength={500}
            onChange={(e) => setDescripcion(e.target.value)}
            aria-describedby={describe("enlace-descripcion", false, "descripcion")}
            aria-invalid={errores.descripcion !== undefined || undefined}
          />
        </Campo>

        <Campo id="enlace-categoria" etiqueta={textos.campoCategoria} error={errores.categoria}>
          <Selector
            id="enlace-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-describedby={describe("enlace-categoria", false, "categoria")}
            aria-invalid={errores.categoria !== undefined || undefined}
          >
            <option value="" disabled>
              {textos.eligeCategoria}
            </option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {textos.categorias[c]}
              </option>
            ))}
          </Selector>
        </Campo>
      </form>
    </Dialogo>
  );
}
