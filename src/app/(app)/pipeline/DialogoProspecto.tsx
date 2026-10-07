"use client";

import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import { avisosProspecto, type ContextoAvisos } from "../../../aplicacion/pipeline/avisos";
import { revisarDatosSensibles } from "../../../aplicacion/pipeline/datosSensibles";
import type { CampoProspecto, ErroresProspecto } from "../../../aplicacion/pipeline/entrada";
import { TOPE_COMENTARIOS, TOPE_NOMBRE } from "../../../aplicacion/pipeline/errores";
import { ESTATUS, estatusEnPantalla, normalizarFecha, normalizarTelefono, type Estatus } from "../../../aplicacion/pipeline/normalizar";
import type { ValoresProspecto } from "../../../aplicacion/pipeline/vista";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { AreaTexto, Campo, Entrada } from "../../../componentes/ui/Campo";
import { Dialogo } from "../../../componentes/ui/Dialogo";
import { Opciones } from "../../../componentes/ui/Opciones";
import type { RespuestaPipeline } from "./acciones";
import { TEXTOS } from "./textosPantalla";

export const VALORES_NUEVO: ValoresProspecto = { nombre: "", contacto: "", comentarios: "", estatus: "INTERESADO", seguimiento: "" };

const OPCIONES_ESTATUS = ESTATUS.map((e) => ({ valor: e, etiqueta: estatusEnPantalla(e) }));
const largo = (s: string) => Array.from(s).length;

/**
 * Alta y edición de un prospecto en un diálogo. Valida mientras se escribe lo
 * que se puede saber en el navegador (datos sensibles y avisos que no
 * bloquean); la acción del servidor vuelve a validar todo y la base tiene la
 * última palabra.
 */
export function DialogoProspecto({
  abierto,
  id,
  iniciales,
  contexto,
  guardar,
  alCerrar,
  alGuardar,
}: {
  readonly abierto: boolean;
  /** null: alta. */
  readonly id: string | null;
  readonly iniciales: ValoresProspecto;
  readonly contexto: ContextoAvisos;
  readonly guardar: (valores: ValoresProspecto) => Promise<RespuestaPipeline>;
  readonly alCerrar: () => void;
  readonly alGuardar: (r: Extract<RespuestaPipeline, { ok: true }>) => void;
}) {
  const base = useId();
  const [valores, setValores] = useState<ValoresProspecto>(iniciales);
  const [errores, setErrores] = useState<ErroresProspecto>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const cambiar = <C extends keyof ValoresProspecto>(campo: C, valor: ValoresProspecto[C]) => {
    setValores((v) => ({ ...v, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  // Lo que se puede revisar en el navegador mientras se escribe.
  const sensibles = useMemo(() => revisarDatosSensibles(valores), [valores]);
  const avisos = useMemo(() => {
    const tel = normalizarTelefono(valores.contacto);
    const fecha = normalizarFecha(valores.seguimiento);
    return avisosProspecto(
      { id: id ?? undefined, contacto: tel.ok ? tel.valor : "", seguimiento: fecha.ok ? fecha.valor : null },
      contexto,
    );
  }, [valores.contacto, valores.seguimiento, id, contexto]);

  const errorDe = (c: CampoProspecto) => errores[c] ?? (c === "nombre" || c === "comentarios" ? sensibles[c] : undefined);
  const describe = (c: CampoProspecto, ayuda: boolean, contador = false) =>
    [ayuda && `${base}-${c}-ayuda`, errorDe(c) !== undefined && `${base}-${c}-error`, contador && `${base}-${c}-contador`]
      .filter(Boolean)
      .join(" ") || undefined;

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    iniciar(async () => {
      const r = await guardar(valores);
      if (r.ok) {
        alGuardar(r);
        return;
      }
      setErrores(r.errores);
      setErrorGeneral(r.mensaje);
    });
  }

  const idForm = `${base}-form`;
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={id === null ? TEXTOS.dialogoNuevo : TEXTOS.dialogoEditar}
      etiquetaCerrar={TEXTOS.cerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            {TEXTOS.cancelar}
          </Boton>
          <Boton type="submit" form={idForm} cargando={enviando}>
            {TEXTOS.guardar}
          </Boton>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
        {errorGeneral !== null && (
          <Aviso role="alert" tono="error" titulo={TEXTOS.notificacionError}>
            {errorGeneral}
          </Aviso>
        )}

        <Campo
          id={`${base}-nombre`}
          etiqueta={TEXTOS.campoNombre}
          error={errorDe("nombre")}
          contador={TEXTOS.contador(largo(valores.nombre), TOPE_NOMBRE)}
        >
          <Entrada
            id={`${base}-nombre`}
            value={valores.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            autoComplete="off"
            autoFocus
            required
            aria-invalid={errorDe("nombre") !== undefined}
            aria-describedby={describe("nombre", false, true)}
          />
        </Campo>

        <Campo id={`${base}-contacto`} etiqueta={TEXTOS.campoContacto} ayuda={TEXTOS.ayudaContacto} error={errorDe("contacto")}>
          <Entrada
            id={`${base}-contacto`}
            type="tel"
            inputMode="tel"
            value={valores.contacto}
            onChange={(e) => cambiar("contacto", e.target.value)}
            autoComplete="off"
            required
            aria-invalid={errorDe("contacto") !== undefined}
            aria-describedby={describe("contacto", true)}
          />
        </Campo>

        <div className="flex flex-col gap-1.5">
          <Opciones<Estatus>
            nombre={`${base}-estatus`}
            leyenda={TEXTOS.campoEstatus}
            opciones={OPCIONES_ESTATUS}
            valor={valores.estatus}
            alCambiar={(v) => cambiar("estatus", v)}
          />
          {errorDe("estatus") !== undefined && <p className="text-sm font-semibold text-error-texto">{errorDe("estatus")}</p>}
        </div>

        <Campo id={`${base}-seguimiento`} etiqueta={TEXTOS.campoSeguimiento} ayuda={TEXTOS.ayudaSeguimiento} error={errorDe("seguimiento")}>
          <Entrada
            id={`${base}-seguimiento`}
            type="date"
            value={valores.seguimiento}
            onChange={(e) => cambiar("seguimiento", e.target.value)}
            aria-invalid={errorDe("seguimiento") !== undefined}
            aria-describedby={describe("seguimiento", true)}
            className="[color-scheme:dark]"
          />
        </Campo>

        <Campo
          id={`${base}-comentarios`}
          etiqueta={TEXTOS.campoComentarios}
          ayuda={TEXTOS.ayudaComentarios}
          error={errorDe("comentarios")}
          contador={TEXTOS.contador(largo(valores.comentarios), TOPE_COMENTARIOS)}
        >
          <AreaTexto
            id={`${base}-comentarios`}
            rows={3}
            value={valores.comentarios}
            onChange={(e) => cambiar("comentarios", e.target.value)}
            aria-invalid={errorDe("comentarios") !== undefined}
            aria-describedby={describe("comentarios", true, true)}
          />
        </Campo>

        {avisos.length > 0 && (
          <Aviso role="status" tono="advertencia" titulo={TEXTOS.tituloAvisos}>
            <ul className="flex flex-col gap-1">
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Aviso>
        )}
      </form>
    </Dialogo>
  );
}
