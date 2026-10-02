const DIGITOS = "0123456789";

/** Una columna 0–9 que se desliza hasta el dígito pedido (tipo odómetro). */
function Digito({ indice }: { readonly indice: number }) {
  return (
    <span className="inline-block h-[1.1em] overflow-hidden align-bottom">
      <span className="odometro-tira flex flex-col" style={{ transform: `translateY(-${indice * 10}%)` }}>
        {Array.from(DIGITOS, (d) => (
          <span key={d} className="block h-[1.1em] leading-[1.1em]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export interface PropsNumeroAnimado {
  /** La cifra ya formateada, tal como llega (por ejemplo "$12,345.67"). */
  readonly valor: string;
  readonly className?: string;
}

/**
 * Cifra con dígitos que ruedan al cambiar. Trabaja con el texto ya formateado:
 * nunca convierte el monto a número. Cada dígito se mueve a su lugar y los
 * signos ($ , . %) se quedan fijos. Las columnas se identifican contando desde
 * la derecha, para que unidades, decenas y centavos sigan en su lugar aunque la
 * cifra cambie de largo. Con movimiento reducido, el cambio es inmediato.
 *
 * El lector de pantalla lee el valor completo una sola vez (texto sr-only); los
 * dígitos visibles van con aria-hidden.
 */
export function NumeroAnimado({ valor, className = "" }: PropsNumeroAnimado) {
  const caracteres = Array.from(valor);
  return (
    <span className={`inline-flex leading-[1.1] whitespace-nowrap ${className}`}>
      <span className="sr-only">{valor}</span>
      <span aria-hidden="true" className="inline-flex">
        {caracteres.map((c, i) => {
          const desdeLaDerecha = caracteres.length - i;
          const indice = DIGITOS.indexOf(c);
          return indice >= 0 ? (
            <Digito key={`d${desdeLaDerecha}`} indice={indice} />
          ) : (
            <span key={`s${desdeLaDerecha}${c}`} className="inline-block h-[1.1em] leading-[1.1em]">
              {c}
            </span>
          );
        })}
      </span>
    </span>
  );
}
