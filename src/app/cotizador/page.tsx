import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { opcionesCotizador } from "../../aplicacion/opciones";
import { leerParametrosCotizacion } from "../../servidor/parametros";
import { Aviso } from "../../componentes/ui/Aviso";
import { Cotizador } from "./Cotizador";
import { TEXTOS } from "./textosPantalla";

export const metadata: Metadata = {
  title: "Cotizador · Crediflexi Inversiones",
};

/**
 * Pantalla del cotizador (componente de servidor). Lee los parámetros en cada
 * petición y pasa al cliente solo texto: ni decimal.js ni la semilla llegan al
 * navegador.
 */
export default async function PaginaCotizador() {
  // Sin esto, next build prerenderizaría la página con la semilla del momento de la compilación.
  await connection();
  const parametros = await leerParametrosCotizacion();

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
        <p className="text-sm text-hielo-tenue">{TEXTOS.avisoLocal}</p>
      </header>

      {parametros.ok ? (
        <Cotizador opciones={opcionesCotizador(parametros.valor)} />
      ) : (
        <Aviso role="alert" tono="error" titulo={TEXTOS.tituloErrorParametros}>
          <p>{parametros.error.mensaje}</p>
          {parametros.error.detalles !== undefined && parametros.error.detalles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {parametros.error.detalles.map((d) => (
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
