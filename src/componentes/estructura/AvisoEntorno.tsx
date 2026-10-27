/**
 * Franja fija arriba de la pantalla mientras ENTORNO no sea "produccion": avisa
 * que es un entorno de prueba. El texto viene de aviso_entorno_prueba en
 * seed/textos_cotizacion.json (ver leerAvisoEntorno en
 * src/servidor/parametros.ts); con null no pinta nada. Amarillo con texto
 * marino: contraste de más de 9:1. No va en los PDF.
 */
export function AvisoEntorno({ texto }: { readonly texto: string | null }) {
  if (texto === null) return null;
  return (
    <p
      role="note"
      className="sticky top-0 z-50 bg-amarillo px-4 py-2 text-center text-sm font-extrabold text-marino pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      {texto}
    </p>
  );
}
