import { Marco } from "../../componentes/estructura/Marco";
import { exigirUsuario } from "../../servidor/sesion";

/**
 * Pantallas con sesión: exige un usuario activo y las envuelve en el menú y el
 * marco. Al navegador solo pasan nombre, rol y sucursal. Ojo: este layout no
 * se vuelve a ejecutar al navegar (Partial Rendering), así que cada página,
 * ruta y acción revisa al usuario por su cuenta.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const { nombre, rol, sucursal } = await exigirUsuario();
  return <Marco usuario={{ nombre, rol, sucursal: sucursal.nombre }}>{children}</Marco>;
}
