"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { Aviso } from "../../componentes/ui/Aviso";
import { Boton } from "../../componentes/ui/Boton";
import { Campo, Entrada } from "../../componentes/ui/Campo";
import { iniciarSesion, type EstadoAcceso } from "./acciones";

const INICIAL: EstadoAcceso = { error: null };

/** Correo y contraseña. El error de la acción se anuncia en cuanto aparece. */
export function FormularioAcceso({ siguiente, aviso }: { readonly siguiente: string; readonly aviso: string | null }) {
  const [estado, accion, enviando] = useActionState(iniciarSesion, INICIAL);
  const error = estado.error ?? aviso;

  return (
    <form action={accion} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="siguiente" value={siguiente} />
      {error !== null && <Aviso tono="error" role="alert" titulo={error} />}
      <Campo id="correo" etiqueta="Correo">
        <Entrada
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          defaultValue={estado.correo}
          required
          maxLength={320}
          aria-invalid={error !== null || undefined}
        />
      </Campo>
      <Campo id="contrasena" etiqueta="Contraseña">
        <Entrada
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          maxLength={320}
          aria-invalid={error !== null || undefined}
        />
      </Campo>
      <Boton type="submit" cargando={enviando} icono={<LogIn aria-hidden="true" className="size-5" />} className="mt-1 w-full">
        Entrar
      </Boton>
    </form>
  );
}
