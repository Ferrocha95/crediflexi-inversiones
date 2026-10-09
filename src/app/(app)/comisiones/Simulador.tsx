"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { OpcionesComisiones } from "../../../aplicacion/comisiones";
import type { TextosComisiones } from "../../../aplicacion/textos";
import type { RespuestaComisiones } from "../../../servidor/comisiones";
import { AvisoSesionExpirada } from "../../../componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada, vistaPreviaSinSesion } from "../../../componentes/acceso/sesionExpirada";
import { Aviso } from "../../../componentes/ui/Aviso";
import { Boton } from "../../../componentes/ui/Boton";
import { Campo, Entrada } from "../../../componentes/ui/Campo";
import { Opciones } from "../../../componentes/ui/Opciones";
import { Selector } from "../../../componentes/ui/Selector";
import { simular } from "./acciones";
import { llenar } from "./plantilla";
import { Resultado } from "./Resultado";
import { TEXTOS } from "./textosPantalla";

/** Pausa antes de simular, para no calcular con cada tecla. */
const PAUSA_MS = 400;

type Perfil = "interno" | "externo";
type Rol = "EJECUTIVO" | "GERENTE";
type Tipo = "nueva" | "renovacion";

interface Fila {
  /** Identificador estable de la fila en la pantalla (no se manda al servidor). */
  readonly clave: number;
  readonly tipo: Tipo;
  readonly monto: string;
  readonly plazo: number | null;
  readonly fecha: string;
}

/** Inversión del equipo del gerente o de los externos de un interno: sin fecha. */
type FilaSinFecha = Omit<Fila, "fecha">;
type ListaSinFecha = "equipo" | "externos";

export interface PropsSimulador {
  readonly opciones: OpcionesComisiones;
  /** Bloque comisiones de seed/textos_cotizacion.json. */
  readonly textos: TextosComisiones;
  readonly rolInicial: Rol;
  /** Hoy en la Ciudad de México, AAAA-MM-DD: fecha inicial de cada inversión nueva. */
  readonly fechaInicial: string;
  readonly maximoInversiones: number;
}

/**
 * Simulador de comisiones del mes. Lo escrito vive solo en el estado de React:
 * no se guarda en el navegador, en cookies, en la URL ni en logs.
 */
export function Simulador({ opciones, textos, rolInicial, fechaInicial, maximoInversiones }: PropsSimulador) {
  const id = useId();
  const siguienteClave = useRef(2);
  const [perfil, setPerfil] = useState<Perfil>("interno");
  const [rol, setRol] = useState<Rol>(rolInicial);
  const [filas, setFilas] = useState<readonly Fila[]>([{ clave: 1, tipo: "nueva", monto: "", plazo: null, fecha: fechaInicial }]);
  /** Solo GERENTE: inversiones de su equipo (bloque opcional). */
  const [equipo, setEquipo] = useState<readonly FilaSinFecha[]>([]);
  /** Solo internos: inversiones de sus externos (Mis externos, bloque opcional). */
  const [externos, setExternos] = useState<readonly FilaSinFecha[]>([]);
  /** Sube con cada cambio: es el número de petición. */
  const [version, setVersion] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaComisiones | null>(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const enfocarFila = useRef<number | null>(null);

  const cambio = () => setVersion((v) => v + 1);

  function cambiarFila(clave: number, cambioFila: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambioFila } : f)));
    cambio();
  }

  function agregar() {
    if (filas.length >= maximoInversiones) return;
    const clave = siguienteClave.current++;
    const ultima = filas.at(-1);
    setFilas((fs) => [...fs, { clave, tipo: "nueva", monto: "", plazo: null, fecha: ultima?.fecha ?? fechaInicial }]);
    enfocarFila.current = clave;
    cambio();
  }

  function quitar(clave: number) {
    setFilas((fs) => fs.filter((f) => f.clave !== clave));
    // Tras quitar una fila, el foco va al botón de agregar (no se pierde en el documento).
    document.getElementById(`${id}-agregar`)?.focus();
    cambio();
  }

  // Listas sin fecha: "equipo" (bono de gerente) y "externos" (Mis externos).
  const fijarLista = (cual: ListaSinFecha) => (cual === "equipo" ? setEquipo : setExternos);

  function agregarSinFecha(cual: ListaSinFecha) {
    if ((cual === "equipo" ? equipo : externos).length >= maximoInversiones) return;
    const clave = siguienteClave.current++;
    fijarLista(cual)((fs) => [...fs, { clave, tipo: "nueva", monto: "", plazo: null }]);
    enfocarFila.current = clave;
    cambio();
  }

  function cambiarSinFecha(cual: ListaSinFecha, clave: number, cambioFila: Partial<FilaSinFecha>) {
    fijarLista(cual)((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambioFila } : f)));
    cambio();
  }

  function quitarSinFecha(cual: ListaSinFecha, clave: number) {
    fijarLista(cual)((fs) => fs.filter((f) => f.clave !== clave));
    document.getElementById(`${id}-agregar-${cual}`)?.focus();
    cambio();
  }

  useEffect(() => {
    if (enfocarFila.current === null) return;
    document.getElementById(`${id}-monto-${enfocarFila.current}`)?.focus();
    enfocarFila.current = null;
  }, [filas, equipo, externos, id]);

  const hayFilas = filas.length > 0;

  useEffect(() => {
    if (!hayFilas) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      const campos = {
        peticion: version,
        perfil,
        rol: perfil === "interno" ? rol : null,
        inversiones: filas.map(({ tipo, monto, plazo, fecha }) => ({ tipo, monto, plazo, fecha })),
        // El equipo solo cuenta con el rol GERENTE (el bloque no se muestra en los demás casos).
        equipo: perfil === "interno" && rol === "GERENTE" ? equipo.map(({ tipo, monto, plazo }) => ({ tipo, monto, plazo })) : [],
        // Mis externos solo cuenta con el perfil interno (el bloque no se muestra al externo).
        externos: perfil === "interno" ? externos.map(({ tipo, monto, plazo }) => ({ tipo, monto, plazo })) : [],
      };
      let r: RespuestaComisiones;
      try {
        r = await simular(campos);
      } catch (e) {
        // El proxy responde 401 a una acción sin sesión y Next lo convierte en este error.
        if (errorEsSesionExpirada(e)) setSesionExpirada(true);
        r = { peticion: version, resultado: { tipo: "error", mensaje: TEXTOS.errorConexion, detalles: [] } };
      }
      if (vistaPreviaSinSesion(r.resultado)) setSesionExpirada(true);
      // Si los campos cambiaron mientras tanto, la respuesta es vieja y se descarta.
      if (!vigente || r.peticion !== version) return;
      setRespuesta(r);
    }, PAUSA_MS);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [perfil, rol, filas, equipo, externos, version, hayFilas]);

  const actual = hayFilas && respuesta !== null && respuesta.peticion === version ? respuesta : null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:gap-8">
      {sesionExpirada && (
        <div className="xl:col-span-2">
          <AvisoSesionExpirada siguiente="/comisiones" />
        </div>
      )}
      <form
        className="superficie flex flex-col gap-5 rounded-2xl p-5 sm:p-6"
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
        aria-labelledby={`${id}-titulo`}
      >
        <h2 id={`${id}-titulo`} className="text-2xl font-bold">
          {TEXTOS.tituloFormulario}
        </h2>

        <Opciones
          nombre={`${id}-perfil`}
          leyenda={TEXTOS.perfil}
          valor={perfil}
          alCambiar={(p) => {
            setPerfil(p);
            cambio();
          }}
          opciones={[
            { valor: "interno", etiqueta: TEXTOS.interno },
            { valor: "externo", etiqueta: TEXTOS.externo },
          ]}
        />

        {perfil === "interno" && (
          <Opciones
            nombre={`${id}-rol`}
            leyenda={TEXTOS.rol}
            valor={rol}
            alCambiar={(r) => {
              setRol(r);
              cambio();
            }}
            opciones={[
              { valor: "EJECUTIVO", etiqueta: TEXTOS.ejecutivo },
              { valor: "GERENTE", etiqueta: TEXTOS.gerente },
            ]}
          />
        )}

        <section aria-labelledby={`${id}-inversiones`} className="flex flex-col gap-4">
          <div>
            <h3 id={`${id}-inversiones`} className="text-lg font-bold">
              {TEXTOS.tituloInversiones}
            </h3>
            <p className="text-sm text-hielo-tenue">{TEXTOS.ayudaInversiones}</p>
          </div>

          <ol className="flex flex-col gap-4">
            {filas.map((f, i) => {
              const n = i + 1;
              const base = `${id}-${f.clave}`;
              return (
                <li key={f.clave}>
                  <fieldset className="flex flex-col gap-3 rounded-xl border border-hielo/20 p-4">
                    <legend className="px-1 font-bold">{TEXTOS.inversion(n)}</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Campo id={`${id}-monto-${f.clave}`} etiqueta={TEXTOS.monto} ayuda={n === 1 ? TEXTOS.ayudaMonto : undefined}>
                        <Entrada
                          id={`${id}-monto-${f.clave}`}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          spellCheck={false}
                          aria-label={`${TEXTOS.monto}, ${TEXTOS.inversion(n).toLowerCase()}`}
                          aria-describedby={n === 1 ? `${id}-monto-${f.clave}-ayuda` : undefined}
                          className="font-bold tabular-nums"
                          value={f.monto}
                          onChange={(e) => cambiarFila(f.clave, { monto: e.target.value })}
                        />
                      </Campo>
                      <Campo id={`${base}-plazo`} etiqueta={TEXTOS.plazo}>
                        <Selector
                          id={`${base}-plazo`}
                          aria-label={`${TEXTOS.plazo}, ${TEXTOS.inversion(n).toLowerCase()}`}
                          value={f.plazo === null ? "" : String(f.plazo)}
                          onChange={(e) => cambiarFila(f.clave, { plazo: e.target.value === "" ? null : Number(e.target.value) })}
                        >
                          <option value="">{TEXTOS.eligePlazo}</option>
                          {opciones.plazos.map((p) => (
                            <option key={p} value={p}>
                              {TEXTOS.opcionPlazo(p)}
                            </option>
                          ))}
                        </Selector>
                      </Campo>
                      <Campo id={`${base}-tipo`} etiqueta={TEXTOS.tipo}>
                        <Selector
                          id={`${base}-tipo`}
                          aria-label={`${TEXTOS.tipo}, ${TEXTOS.inversion(n).toLowerCase()}`}
                          value={f.tipo}
                          onChange={(e) => cambiarFila(f.clave, { tipo: e.target.value === "renovacion" ? "renovacion" : "nueva" })}
                        >
                          <option value="nueva">{TEXTOS.nueva}</option>
                          <option value="renovacion">{TEXTOS.renovacion}</option>
                        </Selector>
                      </Campo>
                      <Campo id={`${base}-fecha`} etiqueta={TEXTOS.fecha}>
                        <Entrada
                          id={`${base}-fecha`}
                          type="date"
                          aria-label={`${TEXTOS.fecha}, ${TEXTOS.inversion(n).toLowerCase()}`}
                          value={f.fecha}
                          onChange={(e) => cambiarFila(f.clave, { fecha: e.target.value })}
                        />
                      </Campo>
                    </div>
                    <Boton
                      variante="fantasma"
                      className="self-start"
                      icono={<Trash2 aria-hidden="true" className="size-5" />}
                      aria-label={TEXTOS.quitarInversion(n)}
                      onClick={() => quitar(f.clave)}
                    >
                      {TEXTOS.quitar}
                    </Boton>
                  </fieldset>
                </li>
              );
            })}
          </ol>

          <Boton
            id={`${id}-agregar`}
            variante="secundario"
            className="self-start"
            icono={<Plus aria-hidden="true" className="size-5" />}
            disabled={filas.length >= maximoInversiones}
            aria-describedby={filas.length >= maximoInversiones ? `${id}-maximo` : undefined}
            onClick={agregar}
          >
            {TEXTOS.agregar}
          </Boton>
          {filas.length >= maximoInversiones && (
            <p id={`${id}-maximo`} className="text-sm text-hielo-tenue">
              {TEXTOS.maximoInversiones(maximoInversiones)}
            </p>
          )}
        </section>

        {perfil === "interno" && rol === "GERENTE" && (
          <p className="rounded-xl border border-amarillo/50 bg-amarillo/10 p-3 text-sm">{textos.notaDobleCaptura}</p>
        )}

        {perfil === "interno" && rol === "GERENTE" && (
          <ListaSinFecha
            idBase={`${id}-equipo`}
            idMonto={(clave) => `${id}-monto-${clave}`}
            idAgregar={`${id}-agregar-equipo`}
            titulo={TEXTOS.tituloEquipo}
            ayuda={TEXTOS.ayudaEquipo}
            nombreFila={TEXTOS.inversionEquipo}
            etiquetaAgregar={TEXTOS.agregarEquipo}
            etiquetaQuitar={TEXTOS.quitarInversionEquipo}
            filas={equipo}
            plazos={opciones.plazos}
            maximo={maximoInversiones}
            alAgregar={() => agregarSinFecha("equipo")}
            alCambiar={(clave, c) => cambiarSinFecha("equipo", clave, c)}
            alQuitar={(clave) => quitarSinFecha("equipo", clave)}
          />
        )}

        {perfil === "interno" && (
          <ListaSinFecha
            idBase={`${id}-externos`}
            idMonto={(clave) => `${id}-monto-${clave}`}
            idAgregar={`${id}-agregar-externos`}
            titulo={textos.tituloMisExternos}
            ayuda={textos.ayudaMisExternos}
            nombreFila={(n) => llenar(textos.inversionExterno, { n })}
            etiquetaAgregar={textos.agregarExterno}
            etiquetaQuitar={(n) => llenar(textos.quitarExterno, { n })}
            filas={externos}
            plazos={opciones.plazos}
            maximo={maximoInversiones}
            alAgregar={() => agregarSinFecha("externos")}
            alCambiar={(clave, c) => cambiarSinFecha("externos", clave, c)}
            alQuitar={(clave) => quitarSinFecha("externos", clave)}
          />
        )}
      </form>

      <section aria-labelledby={`${id}-resultado`} className="flex flex-col gap-4">
        <h2 id={`${id}-resultado`} className="text-2xl font-bold">
          {TEXTOS.tituloResultado}
        </h2>
        {!hayFilas ? (
          <p className="text-hielo">{TEXTOS.sinInversiones}</p>
        ) : actual === null ? (
          <p className="text-hielo" aria-busy="true">
            {TEXTOS.calculando}
          </p>
        ) : actual.resultado.tipo === "error" ? (
          <Aviso role="alert" tono="error" titulo={TEXTOS.tituloError}>
            <p>{actual.resultado.mensaje}</p>
            {actual.resultado.detalles.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm">
                {actual.resultado.detalles.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </Aviso>
        ) : (
          <Resultado modelo={actual.resultado.modelo} textos={textos} />
        )}
        {/* Solo se anuncia el total, no toda la tabla. */}
        <p className="sr-only" aria-live="polite">
          {actual?.resultado.tipo === "modelo" ? `${TEXTOS.comisionPagable}: ${actual.resultado.modelo.totales.comisionPagable}` : ""}
        </p>
      </section>
    </div>
  );
}

interface PropsListaSinFecha {
  readonly idBase: string;
  readonly idMonto: (clave: number) => string;
  readonly idAgregar: string;
  readonly titulo: string;
  readonly ayuda: string;
  /** "Inversión del equipo 1", "Inversión de tus externos 1". */
  readonly nombreFila: (n: number) => string;
  readonly etiquetaAgregar: string;
  readonly etiquetaQuitar: (n: number) => string;
  readonly filas: readonly FilaSinFecha[];
  readonly plazos: readonly number[];
  readonly maximo: number;
  readonly alAgregar: () => void;
  readonly alCambiar: (clave: number, cambio: Partial<FilaSinFecha>) => void;
  readonly alQuitar: (clave: number) => void;
}

/** Lista opcional de inversiones sin fecha: monto, plazo y tipo (equipo del gerente o Mis externos). */
function ListaSinFecha(p: PropsListaSinFecha) {
  return (
    <section aria-labelledby={p.idBase} className="flex flex-col gap-4">
      <div>
        <h3 id={p.idBase} className="text-lg font-bold">
          {p.titulo}
        </h3>
        <p className="text-sm text-hielo-tenue">{p.ayuda}</p>
      </div>
      {p.filas.length > 0 && (
        <ol className="flex flex-col gap-4">
          {p.filas.map((f, i) => {
            const n = i + 1;
            const base = `${p.idBase}-${f.clave}`;
            const nombre = p.nombreFila(n).toLowerCase();
            return (
              <li key={f.clave}>
                <fieldset className="flex flex-col gap-3 rounded-xl border border-hielo/20 p-4">
                  <legend className="px-1 font-bold">{p.nombreFila(n)}</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo id={p.idMonto(f.clave)} etiqueta={TEXTOS.monto}>
                      <Entrada
                        id={p.idMonto(f.clave)}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`${TEXTOS.monto}, ${nombre}`}
                        className="font-bold tabular-nums"
                        value={f.monto}
                        onChange={(e) => p.alCambiar(f.clave, { monto: e.target.value })}
                      />
                    </Campo>
                    <Campo id={`${base}-plazo`} etiqueta={TEXTOS.plazo}>
                      <Selector
                        id={`${base}-plazo`}
                        aria-label={`${TEXTOS.plazo}, ${nombre}`}
                        value={f.plazo === null ? "" : String(f.plazo)}
                        onChange={(e) => p.alCambiar(f.clave, { plazo: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">{TEXTOS.eligePlazo}</option>
                        {p.plazos.map((plazo) => (
                          <option key={plazo} value={plazo}>
                            {TEXTOS.opcionPlazo(plazo)}
                          </option>
                        ))}
                      </Selector>
                    </Campo>
                    <Campo id={`${base}-tipo`} etiqueta={TEXTOS.tipo}>
                      <Selector
                        id={`${base}-tipo`}
                        aria-label={`${TEXTOS.tipo}, ${nombre}`}
                        value={f.tipo}
                        onChange={(e) => p.alCambiar(f.clave, { tipo: e.target.value === "renovacion" ? "renovacion" : "nueva" })}
                      >
                        <option value="nueva">{TEXTOS.nueva}</option>
                        <option value="renovacion">{TEXTOS.renovacion}</option>
                      </Selector>
                    </Campo>
                  </div>
                  <Boton
                    variante="fantasma"
                    className="self-start"
                    icono={<Trash2 aria-hidden="true" className="size-5" />}
                    aria-label={p.etiquetaQuitar(n)}
                    onClick={() => p.alQuitar(f.clave)}
                  >
                    {TEXTOS.quitar}
                  </Boton>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}
      <Boton
        id={p.idAgregar}
        variante="secundario"
        className="self-start"
        icono={<Plus aria-hidden="true" className="size-5" />}
        disabled={p.filas.length >= p.maximo}
        onClick={p.alAgregar}
      >
        {p.etiquetaAgregar}
      </Boton>
    </section>
  );
}
