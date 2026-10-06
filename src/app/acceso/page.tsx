import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { MENSAJES_ACCESO } from "../../aplicacion/acceso/mensajes";
import { siguienteSeguro } from "../../aplicacion/acceso/siguiente";
import { TarjetaVidrio } from "../../componentes/ui/TarjetaVidrio";
import { MENSAJE_ERROR_LECTURA, RUTA_SALIR, resolverSesion, type Sesion } from "../../servidor/sesion";
import { FormularioAcceso } from "./FormularioAcceso";

export const metadata: Metadata = { title: "Entrar · Crediflexi Inversiones" };

/**
 * Pantalla de acceso: una sola tarjeta de vidrio sobre el azul marino, sin
 * menú. Con sesión activa no hace falta: va directo al siguiente. Con sesión
 * de un usuario inactivo, pasa por /acceso/salir para cerrarla.
 */
export default async function Acceso({ searchParams }: PageProps<"/acceso">) {
  const parametros = await searchParams;
  const siguiente = siguienteSeguro(parametros.siguiente);

  // Si la base no responde, la pantalla se muestra igual, con el aviso.
  const sesion: Sesion | null = await resolverSesion().catch(() => null);
  if (sesion?.tipo === "activo") redirect(siguiente);
  if (sesion?.tipo === "inactivo") redirect(RUTA_SALIR);

  const aviso = sesion === null ? MENSAJE_ERROR_LECTURA : parametros.aviso === "inactivo" ? MENSAJES_ACCESO.inactivo : null;

  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4 py-10">
      <TarjetaVidrio como="section" aria-labelledby="titulo-acceso" className="flex w-full max-w-md flex-col gap-6 sm:p-8">
        <Image src="/logo-blanco.png" alt="Crediflexi" width={640} height={201} loading="eager" unoptimized className="h-auto w-48" />
        <div className="flex flex-col gap-1">
          <h1 id="titulo-acceso" className="text-3xl font-extrabold tracking-tight">
            Entrar
          </h1>
          <p className="text-hielo">Usa el correo y la contraseña que te dio tu gerente.</p>
        </div>
        <FormularioAcceso siguiente={siguiente} aviso={aviso} />
      </TarjetaVidrio>
    </main>
  );
}
