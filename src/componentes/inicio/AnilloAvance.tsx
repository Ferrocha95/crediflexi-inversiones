const RADIO = 42;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export interface PropsAnilloAvance {
  /** De 0 a 1, solo para dibujar el arco. La cifra que se lee va en `etiqueta`. */
  readonly fraccion: number;
  /** Texto del centro, ya formateado (por ejemplo "62%"). */
  readonly etiqueta: string;
  /** Lo que lee el lector de pantalla, por ejemplo "62% de avance de la meta del mes". */
  readonly descripcion: string;
}

/**
 * Anillo de avance. No calcula: dibuja la fracción que recibe y muestra el
 * texto que recibe. El arco se anima al cambiar (sin animación con movimiento reducido).
 */
export function AnilloAvance({ fraccion, etiqueta, descripcion }: PropsAnilloAvance) {
  const f = Math.min(1, Math.max(0, fraccion));
  return (
    <div role="img" aria-label={descripcion} className="relative grid size-32 shrink-0 place-items-center">
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={RADIO} fill="none" strokeWidth="9" className="stroke-hielo/15" />
        <circle
          cx="50"
          cy="50"
          r={RADIO}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - f)}
          className="stroke-verde-texto transition-[stroke-dashoffset] duration-500 ease-suave"
        />
      </svg>
      <span aria-hidden="true" className="text-2xl font-extrabold">
        {etiqueta}
      </span>
    </div>
  );
}

/** El mismo anillo vacío, para la tarjeta "Próximamente". */
export function AnilloVacio() {
  return (
    <div aria-hidden="true" className="relative size-32 shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        <circle cx="50" cy="50" r={RADIO} fill="none" strokeWidth="9" className="stroke-hielo/10" />
      </svg>
    </div>
  );
}
