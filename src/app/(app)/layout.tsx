import { Marco } from "../../componentes/estructura/Marco";
import { exigirUsuario } from "../../servidor/sesion";

/**
 * Pantallas con sesión: exige un usuario activo y las envuelve en el menú y el
 * marco. El usuario todavía no se muestra en el menú (llega en la etapa B2).
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  await exigirUsuario();
  return <Marco>{children}</Marco>;
}
