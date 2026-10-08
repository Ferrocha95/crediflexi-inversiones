import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { opcionesComisiones } from "../../../../aplicacion/comisiones";
import { modeloReclutamiento } from "../../../../aplicacion/reclutamiento";
import { Aviso } from "../../../../componentes/ui/Aviso";
import { leerParametrosReclutamiento } from "../../../../servidor/parametros";
import { exigirUsuario } from "../../../../servidor/sesion";
import { TEXTOS } from "../textosPantalla";
import { Reclutamiento } from "./Reclutamiento";

export const metadata: Metadata = {
  title: "Modo reclutamiento · Crediflexi Inversiones",
};

/**
 * Modo reclutamiento (componente de servidor): solo dentro de la app y con
 * sesión. Calcula el resultado inicial con los escenarios de ejemplo, así el
 * aviso con la fecha de las tablas se ve desde el primer momento. Nada se guarda.
 */
export default async function PaginaReclutamiento() {
  // Cada página revisa al usuario: el layout no se vuelve a ejecutar al navegar.
  const usuario = await exigirUsuario();
  // Sin esto, next build prerenderizaría la página con la semilla del momento de la compilación.
  await connection();
  const p = await leerParametrosReclutamiento();

  if (!p.ok) {
    return (
      <div className="flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <Aviso role="alert" tono="error" titulo={TEXTOS.tituloErrorParametros}>
          <p>{p.error.mensaje}</p>
          {p.error.detalles !== undefined && p.error.detalles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {p.error.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm">{TEXTOS.ayudaErrorParametros}</p>
        </Aviso>
      </div>
    );
  }

  const { semilla, textos } = p.valor;
  const inicial = { presenta: usuario.nombre, escenarios: textos.escenariosEjemplo };
  const modelo = modeloReclutamiento(semilla, textos, inicial, new Date());

  return (
    <div className="flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/comisiones"
          className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-hielo underline-offset-4 hover:text-blanco hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {TEXTOS.volverComisiones}
        </Link>
        <h1 className="text-4xl font-extrabold tracking-tight">{textos.tituloPagina}</h1>
        <p className="max-w-prose text-lg text-hielo">{textos.introduccion}</p>
      </header>

      <Reclutamiento
        textos={textos}
        plazos={opcionesComisiones(semilla).plazos}
        inicial={inicial}
        modeloInicial={modelo.ok ? modelo.valor : null}
      />
    </div>
  );
}
