import { Calculator, UserPlus } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { fechaDeHoy, horaEnMexico, saludoPara } from "../../componentes/inicio/saludo";
import {
  TarjetaCarteraTotal,
  TarjetaDocumentosPorVencer,
  TarjetaEnvioViernes,
  TarjetaMeta,
  TarjetaPipelineEstatus,
  TarjetaPlanHoy,
  TarjetaProyeccionSemana,
  TarjetaSeguimientos,
  TarjetaVencimientos,
} from "../../componentes/inicio/TarjetasResumen";
import { LineaFlecha } from "../../componentes/ui/LineaFlecha";
import { exigirUsuario } from "../../servidor/sesion";

const ACCESO =
  "flex min-h-24 items-center gap-4 rounded-2xl p-5 text-left";

/**
 * Inicio. Las tarjetas de resumen siguen en "Próximamente" (se conectan en
 * la etapa E) y NO reciben datos: aquí no se muestra ninguna cifra ni
 * persona inventada. Los datos de ejemplo viven solo en /diseno.
 */
export default async function Home() {
  // Cada página revisa al usuario: el layout no se vuelve a ejecutar al navegar.
  await exigirUsuario();
  // El saludo y la fecha dependen de la hora: sin esto se fijarían al compilar.
  await connection();
  const ahora = new Date();

  return (
    <div className="flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-2">
        <p className="font-semibold text-hielo">{fechaDeHoy(ahora)}</p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-cifra">{saludoPara(horaEnMexico(ahora))}</h1>
        <LineaFlecha className="max-w-64" />
      </header>

      <section aria-labelledby="titulo-accesos" className="flex flex-col gap-4">
        <h2 id="titulo-accesos" className="text-2xl font-bold">
          Accesos rápidos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-4xl">
          <Link href="/cotizador" className={`${ACCESO} vidrio elevable`}>
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-hielo text-marino">
              <Calculator aria-hidden="true" className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-bold">Nueva cotización</span>
              <span className="text-hielo">Calcula una inversión con las tasas vigentes.</span>
            </span>
          </Link>
          <Link href="/pipeline?nuevo=1" className={`${ACCESO} vidrio elevable`}>
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-hielo text-marino">
              <UserPlus aria-hidden="true" className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-bold">Nuevo prospecto</span>
              <span className="text-hielo">Registra un prospecto en tu pipeline.</span>
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="titulo-resumen" className="flex flex-col gap-4">
        <h2 id="titulo-resumen" className="text-2xl font-bold">
          Resumen
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TarjetaMeta />
          <TarjetaPipelineEstatus />
          <TarjetaSeguimientos />
          <TarjetaProyeccionSemana />
          <TarjetaPlanHoy />
          <TarjetaEnvioViernes />
          <TarjetaCarteraTotal />
          <TarjetaVencimientos />
          <TarjetaDocumentosPorVencer />
        </div>
      </section>
    </div>
  );
}
