"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIAS, MENSAJES_BIBLIOTECA, TOPE_BYTES, type ErroresBiblioteca } from "../../../aplicacion/biblioteca/reglas";
import type { TextosBiblioteca } from "../../../aplicacion/textos";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { AreaTexto, Campo, CLASE_CONTROL, Entrada } from "../../../componentes/ui/Campo";
import { Casilla } from "../../../componentes/ui/Casilla";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { Selector } from "../../../componentes/ui/Selector";

const ACEPTA = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.docx,.xlsx,.pptx,.txt,.csv";

/**
 * Subir un archivo (solo Director regional y Gerente). Manda un formulario
 * multipart a POST /biblioteca/subir, que revisa todo de nuevo con los bytes
 * reales; aquí solo se adelantan los avisos más comunes (falta el archivo, la
 * categoría o la casilla, o pasa de 25 MB).
 */
export function DialogoSubir({
  abierto,
  textos,
  alCerrar,
  alSubir,
  alSesionExpirada,
}: {
  readonly abierto: boolean;
  readonly textos: TextosBiblioteca;
  readonly alCerrar: () => void;
  readonly alSubir: () => void;
  readonly alSesionExpirada: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [errores, setErrores] = useState<ErroresBiblioteca>({});
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  function cerrar() {
    if (subiendo) return;
    setArchivo(null);
    setNombre("");
    setDescripcion("");
    setCategoria("");
    setConfirmado(false);
    setErrores({});
    setError(null);
    alCerrar();
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const previos: ErroresBiblioteca = {};
    if (archivo === null) previos.archivo = MENSAJES_BIBLIOTECA.sinArchivo;
    else if (archivo.size > TOPE_BYTES) previos.archivo = MENSAJES_BIBLIOTECA.muyGrande;
    if (categoria === "") previos.categoria = MENSAJES_BIBLIOTECA.categoriaInvalida;
    if (!confirmado) previos.confirmacion = MENSAJES_BIBLIOTECA.sinConfirmacion;
    setErrores(previos);
    if (Object.keys(previos).length > 0 || archivo === null) return;

    const datos = new FormData();
    datos.set("archivo", archivo);
    datos.set("nombre", nombre);
    datos.set("descripcion", descripcion);
    datos.set("categoria", categoria);
    datos.set("confirmacion", "si");

    setSubiendo(true);
    try {
      const r = await fetch("/biblioteca/subir", { method: "POST", body: datos });
      if (r.status === 401) {
        setError(MENSAJE_SESION_EXPIRADA);
        alSesionExpirada();
        return;
      }
      const cuerpo = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; errores?: ErroresBiblioteca } | null;
      if (!r.ok || cuerpo === null || cuerpo.ok !== true) {
        setErrores(cuerpo?.errores ?? {});
        setError(cuerpo?.error ?? textos.fallaRed);
        return;
      }
      setSubiendo(false);
      setArchivo(null);
      setNombre("");
      setDescripcion("");
      setCategoria("");
      setConfirmado(false);
      setErrores({});
      alSubir();
    } catch {
      setError(textos.fallaRed);
    } finally {
      setSubiendo(false);
    }
  }

  const describe = (id: string, conAyuda: boolean, campo: keyof ErroresBiblioteca) =>
    [conAyuda ? `${id}-ayuda` : null, errores[campo] !== undefined ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={cerrar}
      titulo={textos.subirArchivo}
      etiquetaCerrar={textos.cerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={subiendo}>
            {textos.cancelar}
          </Boton>
          <Boton type="submit" form="form-subir" cargando={subiendo}>
            {subiendo ? textos.subiendo : textos.subir}
          </Boton>
        </>
      }
    >
      <form id="form-subir" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Aviso tono="advertencia" titulo={textos.tituloAvisoCuentas}>
          {textos.avisoCuentas}
        </Aviso>

        {error !== null && (
          <Aviso role="alert" tono="error" titulo={textos.tituloError}>
            {error}
          </Aviso>
        )}

        <Campo id="subir-archivo" etiqueta={textos.campoArchivo} ayuda={textos.ayudaArchivo} error={errores.archivo}>
          <input
            id="subir-archivo"
            type="file"
            accept={ACEPTA}
            aria-describedby={describe("subir-archivo", true, "archivo")}
            aria-invalid={errores.archivo !== undefined || undefined}
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setErrores((v) => ({ ...v, archivo: undefined }));
            }}
            className={`${CLASE_CONTROL} cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-hielo file:px-3 file:py-1.5 file:font-bold file:text-marino`}
          />
        </Campo>

        <Campo id="subir-nombre" etiqueta={textos.campoNombre} ayuda={textos.ayudaNombreArchivo} error={errores.nombre}>
          <Entrada
            id="subir-nombre"
            value={nombre}
            maxLength={150}
            onChange={(e) => setNombre(e.target.value)}
            aria-describedby={describe("subir-nombre", true, "nombre")}
            aria-invalid={errores.nombre !== undefined || undefined}
          />
        </Campo>

        <Campo id="subir-descripcion" etiqueta={textos.campoDescripcion} error={errores.descripcion}>
          <AreaTexto
            id="subir-descripcion"
            rows={3}
            value={descripcion}
            maxLength={500}
            onChange={(e) => setDescripcion(e.target.value)}
            aria-describedby={describe("subir-descripcion", false, "descripcion")}
            aria-invalid={errores.descripcion !== undefined || undefined}
          />
        </Campo>

        <Campo id="subir-categoria" etiqueta={textos.campoCategoria} error={errores.categoria}>
          <Selector
            id="subir-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-describedby={describe("subir-categoria", false, "categoria")}
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

        <div className="flex flex-col gap-1">
          <Casilla
            etiqueta={textos.confirmacion}
            checked={confirmado}
            onChange={(e) => {
              setConfirmado(e.target.checked);
              setErrores((v) => ({ ...v, confirmacion: undefined }));
            }}
            aria-describedby={errores.confirmacion !== undefined ? "subir-confirmacion-error" : undefined}
            aria-invalid={errores.confirmacion !== undefined || undefined}
            required
          />
          {errores.confirmacion !== undefined && (
            <p id="subir-confirmacion-error" className="text-sm font-semibold text-error-texto">
              {errores.confirmacion}
            </p>
          )}
        </div>
      </form>
    </Dialogo>
  );
}
