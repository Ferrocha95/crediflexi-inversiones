/**
 * Bloque de carga. Va con aria-hidden: el texto de "cargando" lo pone quien lo
 * usa. Dale la misma altura que el contenido final para que nada salte.
 */
export function Esqueleto({ className = "" }: { readonly className?: string }) {
  return <div aria-hidden="true" className={`esqueleto rounded-lg ${className}`} />;
}
