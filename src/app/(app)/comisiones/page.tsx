import { ChevronLeft, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { opcionesComisiones } from "../../../aplicacion/comisiones";
import { fechaIsoEnMexico } from "../../../aplicacion/fecha";
import { Aviso } from "../../../componentes/ui/Aviso";
import { MAXIMO_INVERSIONES } from "../../../servidor/comisiones";
import { leerSemillaComisiones, leerTextosComisiones } from "../../../servidor/parametros";
import { exigirUsuario } from "../../../servidor/sesion";
import { Simulador } from "./Simulador";
import { TEXTOS } from "./textosPantalla";

export const metadata: Metadata = {
  title: "Comisiones · Crediflexi Inversiones",
};

/**
 * Simulador de comisiones (componente de servidor). Lee la semilla y los textos
 * en cada petición y pasa al cliente solo texto y números: ni decimal.js ni la
 * semilla llegan al navegador. Nada se guarda.
 */
export default async function PaginaComisiones() {
  // Cada página revisa al usuario: el layout no se vuelve a ejecutar al navegar.
  const usuario = await exigirUsuario();
  // Sin esto, next build prerenderizaría la página con la semilla del momento de la compilación.
  await connection();
  const [semilla, textos] = await Promise.all([leerSemillaComisiones(), leerTextosComisiones()]);
  const fallo = !semilla.ok ? semilla.error : !textos.ok ? textos.error : null;
  const rolInicial = usuario.rol === "GERENTE" ? "GERENTE" : "EJECUTIVO";

  return (
    <div className="flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-hielo underline-offset-4 hover:text-blanco hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {TEXTOS.volverInicio}
        </Link>
        <h1 className="text-4xl font-extrabold tracking-tight">{TEXTOS.tituloPagina}</h1>
        <p className="max-w-prose text-lg text-hielo">{TEXTOS.introduccion}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-hielo">
          <Link
            href="/comisiones/reclutamiento"
            className="inline-flex min-h-11 items-center gap-1.5 font-bold text-blanco underline underline-offset-4"
          >
            <Megaphone aria-hidden="true" className="size-4" />
            {TEXTOS.irReclutamiento}
          </Link>
          <span className="text-sm text-hielo-tenue">{TEXTOS.ayudaIrReclutamiento}</span>
        </p>
      </header>

      {semilla.ok && textos.ok ? (
        <Simulador
          opciones={opcionesComisiones(semilla.valor)}
          textos={textos.valor}
          rolInicial={rolInicial}
          fechaInicial={fechaIsoEnMexico(new Date())}
          maximoInversiones={MAXIMO_INVERSIONES}
        />
      ) : (
        <Aviso role="alert" tono="error" titulo={TEXTOS.tituloErrorParametros}>
          <p>{fallo?.mensaje}</p>
          {fallo?.detalles !== undefined && fallo.detalles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {fallo.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">{TEXTOS.ayudaErrorParametros}</p>
        </Aviso>
      )}
    </div>
  );
}
