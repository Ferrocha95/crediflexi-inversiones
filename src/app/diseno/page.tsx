import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Aviso } from "../../componentes/ui/Aviso";
import { Boton } from "../../componentes/ui/Boton";
import { Esqueleto } from "../../componentes/ui/Esqueleto";
import { EstadoVacio } from "../../componentes/ui/EstadoVacio";
import { ESTATUS_PIPELINE, InsigniaEstatus } from "../../componentes/ui/InsigniaEstatus";
import { TarjetaCifra } from "../../componentes/ui/TarjetaCifra";
import { TarjetaVidrio } from "../../componentes/ui/TarjetaVidrio";
import { CuadriculaSemanal } from "../../componentes/vistas/CuadriculaSemanal";
import { TablaPipeline } from "../../componentes/vistas/TablaPipeline";
import { TablaProyeccion } from "../../componentes/vistas/TablaProyeccion";
import {
  TarjetaEnvioViernes,
  TarjetaMeta,
  TarjetaPipelineEstatus,
  TarjetaPlanHoy,
  TarjetaProyeccionSemana,
  TarjetaSeguimientos,
} from "../../componentes/inicio/TarjetasResumen";
import {
  ENVIO_EJEMPLO,
  META_EJEMPLO,
  PIPELINE_EJEMPLO,
  PIPELINE_ESTATUS_EJEMPLO,
  PLAN_HOY_EJEMPLO,
  PROYECCION_EJEMPLO,
  PROYECCION_SEMANA_EJEMPLO,
  SEGUIMIENTOS_EJEMPLO,
  SEMANA_EJEMPLO,
  TOTAL_PROYECCION_EJEMPLO,
} from "./datosEjemplo";
import { DemoBotones, DemoControles, DemoDialogoYNotificaciones, DemoNumero, DemoPestanas } from "./Demos";

export const metadata: Metadata = {
  title: "Catálogo de diseño · Crediflexi Inversiones",
};

/** Rótulo obligatorio en todo lo que muestra datos sintéticos. */
function DatosDeEjemplo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amarillo/70 px-3 py-1 text-sm font-semibold text-hielo">
      <FlaskConical aria-hidden="true" className="size-4 text-amarillo" />
      Datos de ejemplo
    </span>
  );
}

function Seccion({ titulo, descripcion, ejemplo = false, children }: { titulo: string; descripcion?: string; ejemplo?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-hielo/10 pt-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">{titulo}</h2>
        {ejemplo && <DatosDeEjemplo />}
      </div>
      {descripcion !== undefined && <p className="max-w-prose text-hielo">{descripcion}</p>}
      {children}
    </section>
  );
}

/**
 * Catálogo de componentes, para revisar el diseño completo. Como toda la app,
 * solo responde en localhost (src/proxy.ts) y no aparece en el menú. Todo lo
 * que muestra son datos sintéticos.
 */
export default function PaginaDiseno() {
  return (
    <div className="flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight">Catálogo de diseño</h1>
        <p className="max-w-prose text-lg text-hielo">
          Todos los componentes de la app en un solo lugar. Lo que se ve aquí son datos de ejemplo: no son clientes ni
          cifras reales.
        </p>
      </header>

      <Seccion titulo="Cifras y totales" descripcion="El número rueda dígito por dígito cuando cambia. Solo las tarjetas importantes llevan vidrio." ejemplo>
        <div className="grid gap-6 lg:grid-cols-2">
          <DemoNumero />
          <TarjetaVidrio className="flex flex-col gap-5">
            <TarjetaCifra etiqueta="Rendimiento mensual" valor="$3,125.00" tono="positivo">
              Fórmula: monto × tasa anual ÷ 12
            </TarjetaCifra>
            <TarjetaCifra etiqueta="Monto invertido" valor="$250,000.00">
              Cifra neutra, en blanco.
            </TarjetaCifra>
          </TarjetaVidrio>
        </div>
      </Seccion>

      <Seccion
        titulo="Inicio"
        descripcion="Las tarjetas de resumen de la página de inicio, llenas. En / van todas en «Próximamente», sin datos, hasta que existan sus módulos."
        ejemplo
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TarjetaMeta datos={META_EJEMPLO} />
          <TarjetaPipelineEstatus datos={PIPELINE_ESTATUS_EJEMPLO} />
          <TarjetaSeguimientos datos={SEGUIMIENTOS_EJEMPLO} />
          <TarjetaProyeccionSemana datos={PROYECCION_SEMANA_EJEMPLO} />
          <TarjetaPlanHoy datos={PLAN_HOY_EJEMPLO} />
          <TarjetaEnvioViernes datos={ENVIO_EJEMPLO} />
        </div>
        <p className="text-hielo">Así se ven en / mientras no hay datos:</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TarjetaMeta />
          <TarjetaPipelineEstatus />
          <TarjetaSeguimientos />
        </div>
      </Seccion>

      <Seccion titulo="Pipeline" descripcion="Cada fila se pinta con el color de su estatus, como en el Excel. En el celular, cada fila es una tarjeta." ejemplo>
        <div className="flex flex-wrap gap-2">
          {ESTATUS_PIPELINE.map((e) => (
            <InsigniaEstatus key={e} estatus={e} />
          ))}
        </div>
        <TablaPipeline titulo="Pipeline de ejemplo" filas={PIPELINE_EJEMPLO} />
      </Seccion>

      <Seccion titulo="Plan semanal" descripcion="De lunes a viernes, de 9:00 a 18:00, con ¿Dónde? y Qué por día. En pantallas angostas se ve un día a la vez." ejemplo>
        <CuadriculaSemanal titulo="Plan semanal de ejemplo" dias={SEMANA_EJEMPLO} />
      </Seccion>

      <Seccion titulo="Proyección" descripcion="El total llega ya calculado: la tabla no suma nada." ejemplo>
        <TablaProyeccion titulo="Proyección de ejemplo" filas={PROYECCION_EJEMPLO} total={TOTAL_PROYECCION_EJEMPLO} />
      </Seccion>

      <Seccion titulo="Campos y selectores" ejemplo>
        <DemoControles />
      </Seccion>

      <Seccion titulo="Botones">
        <DemoBotones />
      </Seccion>

      <Seccion titulo="Pestañas" descripcion="Con el teclado: Tab entra a la pestaña activa y las flechas cambian de pestaña.">
        <DemoPestanas />
      </Seccion>

      <Seccion titulo="Diálogo y notificaciones" ejemplo>
        <DemoDialogoYNotificaciones />
      </Seccion>

      <Seccion titulo="Avisos" ejemplo>
        <div className="grid gap-3 md:grid-cols-2">
          <Aviso tono="error" titulo="No se pudo calcular la cotización">
            El monto debe ser mayor que cero. Corrígelo y la vista previa se actualiza sola.
          </Aviso>
          <Aviso tono="advertencia" titulo="Aviso">
            La tasa de este tramo está por confirmar.
          </Aviso>
          <Aviso tono="exito" titulo="Listo: el PDF se descargó." />
          <Aviso tono="info" titulo="Versión solo local">
            Sin login y sin base de datos.
          </Aviso>
        </div>
      </Seccion>

      <Seccion titulo="Carga y estado vacío">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="superficie flex flex-col gap-3 rounded-2xl p-5" aria-busy="true">
            <p className="sr-only">Cargando…</p>
            <Esqueleto className="h-5 w-1/3" />
            <Esqueleto className="h-12 w-2/3" />
            <Esqueleto className="h-4 w-full" />
            <Esqueleto className="h-4 w-5/6" />
          </div>
          <EstadoVacio
            titulo="Todavía no hay prospectos esta semana"
            descripcion="Agrega el primero para empezar el pipeline del viernes."
            accion={<Boton variante="secundario" disabled>Agregar prospecto (próximamente)</Boton>}
          />
        </div>
      </Seccion>
    </div>
  );
}
