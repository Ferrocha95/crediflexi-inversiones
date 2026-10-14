import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Decimal } from "../../../../domain/comun/decimal";
import { formatearPesos } from "../../../../domain/comun/formato";
import { opcionesComisiones } from "../../../../aplicacion/comisiones";
import { limpiarCampo } from "../../../../aplicacion/campos";
import { INVERSIONES_POR_PLAZO, modeloReclutamiento, TOPES_RECLUTAMIENTO } from "../../../../aplicacion/reclutamiento";
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
 * aviso con la fecha de las tablas se ve desde el primer momento. Empieza en el
 * perfil externo; el título y la introducción cambian con el perfil, así que
 * los dibuja la pantalla. Nada se guarda.
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
  const presenta = limpiarCampo(usuario.nombre, TOPES_RECLUTAMIENTO.presenta);
  // Montos de un toque: "$1,000,000" en el botón y "1,000,000" en la entrada.
  const enPesos = (v: string) => formatearPesos(new Decimal(v)).replace(/\.00$/, "");
  const montosEjemplo = textos.montosEjemplo.map((valor) => ({ valor, etiqueta: enPesos(valor), escrito: enPesos(valor).replace("$", "") }));
  const inicial = {
    perfil: "externo" as const,
    presenta,
    monto: enPesos(textos.montoPorOmision).replace("$", ""),
    plazo: null,
    mezcla: {},
    inversionesPorPlazo: String(INVERSIONES_POR_PLAZO.porOmision),
  };
  const modelo = modeloReclutamiento(semilla, textos, { presenta, monto: inicial.monto, inversionesPorPlazo: INVERSIONES_POR_PLAZO.porOmision }, new Date());

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
      </header>

      <Reclutamiento
        textos={textos}
        plazos={opcionesComisiones(semilla).plazos}
        montosEjemplo={montosEjemplo}
        inicial={inicial}
        modeloInicial={modelo.ok ? modelo.valor : null}
      />
    </div>
  );
}
