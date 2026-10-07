"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { MENSAJES_ARCHIVO, resumenImportacion, TOPES_IMPORTACION, TIPO_XLSX, type ConteoImportacion } from "../../../aplicacion/excel/archivo";
import { errorEsSesionExpirada } from "../../../componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../componentes/acceso/textos";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo, CLASE_CONTROL } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { confirmarImportacion } from "./acciones";
import { TEXTOS } from "./textosPantalla";

/** Lo que responde POST /pipeline/importar (src/servidor/excel/importar.ts), ya como JSON. */
interface FilaVistaPrevia {
  readonly fila: number;
  readonly estado: "importable" | "con_aviso" | "rechazada";
  readonly nombre: string;
  readonly datos: Record<string, string> | null;
  readonly correcciones: readonly string[];
  readonly avisos: readonly string[];
  readonly motivo: string | null;
}
interface VistaPrevia {
  readonly hoja: string;
  readonly filas: readonly FilaVistaPrevia[];
  readonly conteo: ConteoImportacion;
}

const ESTADO: Record<FilaVistaPrevia["estado"], { texto: string; clase: string }> = {
  importable: { texto: "Se importa", clase: "bg-verde-texto/15 text-verde-texto" },
  con_aviso: { texto: "Se importa con aviso", clase: "bg-amarillo/15 text-amarillo" },
  rechazada: { texto: "No se importa", clase: "bg-error-texto/15 text-error-texto" },
};

const ID_ARCHIVO = "archivo-importar";

/**
 * Importar un Excel en tres pasos: elegir el archivo, revisar la vista previa
 * (el servidor lee el archivo y no guarda nada) y confirmar (la acción vuelve
 * a validar todo e inserta en una sola operación).
 */
export function DialogoImportar({
  abierto,
  alCerrar,
  alImportar,
  alSesionExpirada,
}: {
  readonly abierto: boolean;
  readonly alCerrar: () => void;
  readonly alImportar: (insertadas: number) => void;
  readonly alSesionExpirada: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const porImportar = vista?.filas.filter((f) => f.datos !== null) ?? [];

  function revisar(e: FormEvent) {
    e.preventDefault();
    if (archivo === null) return;
    setError(null);
    if (archivo.size > TOPES_IMPORTACION.bytes) {
      setError(MENSAJES_ARCHIVO.muyGrande);
      return;
    }
    iniciar(async () => {
      try {
        const r = await fetch("/pipeline/importar", {
          method: "POST",
          headers: { "content-type": "application/octet-stream", "x-nombre-archivo": encodeURIComponent(archivo.name) },
          body: archivo,
        });
        if (r.status === 401) {
          setError(MENSAJE_SESION_EXPIRADA);
          alSesionExpirada();
          return;
        }
        const cuerpo = (await r.json().catch(() => null)) as (VistaPrevia & { error?: string }) | null;
        if (!r.ok || cuerpo === null || cuerpo.error !== undefined) {
          setError(cuerpo?.error ?? TEXTOS.importarFalla);
          return;
        }
        setVista(cuerpo);
      } catch {
        setError(TEXTOS.importarFalla);
      }
    });
  }

  function confirmar() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await confirmarImportacion(porImportar.map((f) => ({ fila: f.fila, datos: f.datos })));
        if (r.ok) {
          alImportar(r.insertadas);
          return;
        }
        if (r.mensaje === MENSAJE_SESION_EXPIRADA) alSesionExpirada();
        setError(r.mensaje);
      } catch (e) {
        if (errorEsSesionExpirada(e)) alSesionExpirada();
        setError(errorEsSesionExpirada(e) ? MENSAJE_SESION_EXPIRADA : TEXTOS.importarFalla);
      }
    });
  }

  const otroArchivo = () => {
    setVista(null);
    setArchivo(null);
    setError(null);
  };

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={TEXTOS.importarExcel}
      etiquetaCerrar={TEXTOS.cerrar}
      acciones={
        vista === null ? (
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              {TEXTOS.cancelar}
            </Boton>
            <Boton type="submit" form="form-importar" cargando={ocupado} disabled={archivo === null}>
              {TEXTOS.revisarArchivo}
            </Boton>
          </>
        ) : (
          <>
            <Boton variante="secundario" onClick={otroArchivo} disabled={ocupado}>
              {TEXTOS.elegirOtro}
            </Boton>
            {porImportar.length > 0 && (
              <Boton onClick={confirmar} cargando={ocupado}>
                {TEXTOS.importarN(porImportar.length)}
              </Boton>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error !== null && (
          <Aviso role="alert" tono="error" titulo={TEXTOS.importarNoSePudo}>
            {error}
          </Aviso>
        )}

        {vista === null ? (
          <form id="form-importar" onSubmit={revisar} className="flex flex-col gap-3">
            <Campo id={ID_ARCHIVO} etiqueta={TEXTOS.campoArchivo} ayuda={TEXTOS.ayudaArchivo}>
              <input
                id={ID_ARCHIVO}
                type="file"
                accept={`.xlsx,${TIPO_XLSX}`}
                aria-describedby={`${ID_ARCHIVO}-ayuda`}
                onChange={(e) => {
                  setArchivo(e.target.files?.[0] ?? null);
                  setError(null);
                }}
                className={`${CLASE_CONTROL} cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-hielo file:px-3 file:py-1.5 file:font-bold file:text-marino`}
              />
            </Campo>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 font-semibold text-blanco" role="status">
              <FileSpreadsheet aria-hidden="true" className="size-5 shrink-0 text-hielo" />
              {resumenImportacion(vista.conteo)}
            </p>
            <p className="text-sm text-hielo-tenue">{TEXTOS.hojaLeida(vista.hoja)}</p>
            <ul aria-label={TEXTOS.filasDelArchivo} className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1">
              {vista.filas.map((f) => (
                <li key={f.fila} className="rounded-xl border border-hielo/15 bg-marino/50 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-blanco">
                      <span className="mr-2 text-sm font-semibold text-hielo-tenue">{TEXTOS.filaN(f.fila)}</span>
                      {f.nombre === "" ? TEXTOS.sinNombre : f.nombre}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ESTADO[f.estado].clase}`}>{ESTADO[f.estado].texto}</span>
                  </div>
                  {f.motivo !== null && <p className="mt-1 text-sm text-hielo">{f.motivo}</p>}
                  {[...f.correcciones, ...f.avisos].length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-sm text-hielo">
                      {[...f.correcciones, ...f.avisos].map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialogo>
  );
}
