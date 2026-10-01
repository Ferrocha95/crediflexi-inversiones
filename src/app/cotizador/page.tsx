import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { opcionesCotizador } from "../../aplicacion/opciones";
import { leerParametrosCotizacion } from "../../servidor/parametros";
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-sm underline">
          {TEXTOS.volverInicio}
        </Link>
        <h1 className="text-2xl font-bold">{TEXTOS.tituloPagina}</h1>
        <p>{TEXTOS.introduccion}</p>
        <p className="text-sm opacity-70">{TEXTOS.avisoLocal}</p>
      </header>

      {parametros.ok ? (
        <Cotizador opciones={opcionesCotizador(parametros.valor)} />
      ) : (
        <div role="alert" className="rounded-md border-2 border-red-600 p-4">
          <h2 className="font-semibold">{TEXTOS.tituloErrorParametros}</h2>
          <p className="mt-1">{parametros.error.mensaje}</p>
          {parametros.error.detalles !== undefined && parametros.error.detalles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {parametros.error.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">{TEXTOS.ayudaErrorParametros}</p>
        </div>
      )}
    </main>
  );
}
