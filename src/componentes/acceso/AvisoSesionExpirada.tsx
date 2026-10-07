import { Aviso } from "../ui/Aviso";
import { MENSAJE_SESION_EXPIRADA, TEXTO_VOLVER_A_ENTRAR } from "./textos";

/** Aviso de sesión expirada con un enlace a /acceso que regresa a `siguiente`. */
export function AvisoSesionExpirada({ siguiente }: { readonly siguiente: string }) {
  const destino = `/acceso?siguiente=${encodeURIComponent(siguiente)}`;
  return (
    <Aviso role="alert" tono="advertencia" titulo={MENSAJE_SESION_EXPIRADA}>
      <a href={destino} className="inline-flex min-h-11 items-center font-bold text-blanco underline underline-offset-4">
        {TEXTO_VOLVER_A_ENTRAR}
      </a>
    </Aviso>
  );
}
