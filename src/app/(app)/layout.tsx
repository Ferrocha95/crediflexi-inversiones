import { Marco } from "../../componentes/estructura/Marco";
import { leerAvisoEntorno } from "../../servidor/parametros";
import { exigirUsuario } from "../../servidor/sesion";

/**
 * Pantallas con sesión: exige un usuario activo y las envuelve en el menú y el
 * marco. Al navegador solo pasan nombre, rol y sucursal. Ojo: este layout no
 * se vuelve a ejecutar al navegar (Partial Rendering), así que cada página,
 * ruta y acción revisa al usuario por su cuenta. Fuera de producción, el
 * marco lleva la franja del entorno de prueba.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { nombre, rol, sucursal } = await exigirUsuario();
  const aviso = await leerAvisoEntorno();
  return (
    <Marco usuario={{ nombre, rol, sucursal: sucursal.nombre }} aviso={aviso}>
      {children}
    </Marco>
  );
}
