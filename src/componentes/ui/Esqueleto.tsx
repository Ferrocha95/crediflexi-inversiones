/**
 * Bloque de carga. Va con aria-hidden: el texto de "cargando" lo pone quien lo
 * usa. Dale la misma altura que el contenido final para que nada salte.
 *
 * `quieto`: sin brillo, para lo que no está cargando sino que todavía no existe
 * (las tarjetas "Próximamente"); el brillo daría a entender que algo viene en camino.
 */
export function Esqueleto({ className = "", quieto = false }: { readonly className?: string; readonly quieto?: boolean }) {
  return <div aria-hidden="true" className={`${quieto ? "esqueleto-quieto" : "esqueleto"} rounded-lg ${className}`} />;
}
