import type { Metadata } from "next";
import { connection } from "next/server";
import { MENSAJES_BIBLIOTECA, puedeAdministrar } from "../../../aplicacion/biblioteca/reglas";
import { elementoParaPantalla, type FilaBiblioteca } from "../../../aplicacion/biblioteca/vista";
import { Aviso } from "../../../componentes/ui/Aviso";
import { listarElementos } from "../../../servidor/biblioteca/consultas";
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
 * también lo archivado. Al navegador pasan los elementos ya formateados, sin
 * la ruta del almacenamiento: los archivos se piden por id.
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
  try {
    filas = await listarElementos(await crearClienteServidor());
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
        administra={puedeAdministrar(usuario.rol)}
      />
    </div>
  );
}
