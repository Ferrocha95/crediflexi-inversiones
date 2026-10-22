import type { Metadata } from "next";
import { connection } from "next/server";
import { MENSAJES_BIBLIOTECA, puedeAdministrar } from "../../../aplicacion/biblioteca/reglas";
import { carpetaParaPantalla, elementoParaPantalla, type FilaBiblioteca, type FilaCarpeta } from "../../../aplicacion/biblioteca/vista";
import { Aviso } from "../../../componentes/ui/Aviso";
import { listarCarpetas, listarElementos } from "../../../servidor/biblioteca/consultas";
import { leerTextosBiblioteca } from "../../../servidor/parametros";
import { exigirUsuario } from "../../../servidor/sesion";
import { crearClienteServidor } from "../../../servidor/supabase/servidor";
import { Biblioteca } from "./Biblioteca";

export const metadata: Metadata = {
  title: "Biblioteca · Crediflexi Inversiones",
};

/**
 * Biblioteca (componente de servidor). Lee con la sesión del usuario, así que
 * RLS decide qué ve: su organización y, si es Director regional o Gerente,
 * también lo archivado (elementos y subcarpetas). Al navegador pasan los
 * elementos y las carpetas ya formateados, sin la ruta del almacenamiento: los
 * archivos se piden por id.
 */
export default async function PaginaBiblioteca() {
  // Cada página revisa al usuario: el layout no se vuelve a ejecutar al navegar.
  const usuario = await exigirUsuario();
  await connection();

  const textos = await leerTextosBiblioteca();
  if (!textos.ok) {
    return (
      <div className="flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Biblioteca</h1>
        <Aviso role="alert" tono="error" titulo="No se pudieron leer los textos de la Biblioteca">
          {textos.error.mensaje}
        </Aviso>
      </div>
    );
  }

  let filas: FilaBiblioteca[];
  let carpetas: FilaCarpeta[];
  try {
    const cliente = await crearClienteServidor();
    [filas, carpetas] = await Promise.all([listarElementos(cliente), listarCarpetas(cliente)]);
  } catch {
    return (
      <div className="flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="text-4xl font-extrabold tracking-tight">{textos.valor.tituloPagina}</h1>
        <Aviso role="alert" tono="error" titulo={textos.valor.tituloErrorLectura}>
          {MENSAJES_BIBLIOTECA.fallaLectura}
        </Aviso>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <Biblioteca
        textos={textos.valor}
        elementos={filas.map((f) => elementoParaPantalla(f, textos.valor.tipoEnlace))}
        carpetas={carpetas.map(carpetaParaPantalla)}
        administra={puedeAdministrar(usuario.rol)}
      />
    </div>
  );
}
