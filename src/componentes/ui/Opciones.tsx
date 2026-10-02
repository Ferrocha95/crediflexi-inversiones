import type { ReactNode } from "react";

export interface Opcion<V extends string> {
  readonly valor: V;
  readonly etiqueta: ReactNode;
}

export interface PropsOpciones<V extends string> {
  readonly nombre: string;
  readonly leyenda: ReactNode;
  readonly opciones: readonly Opcion<V>[];
  readonly valor: V;
  readonly alCambiar: (valor: V) => void;
}

/**
 * Grupo de radios con aspecto de control segmentado. Son radios nativos: las
 * flechas del teclado cambian la opción, como en cualquier grupo de radios.
 */
export function Opciones<V extends string>({ nombre, leyenda, opciones, valor, alCambiar }: PropsOpciones<V>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-semibold text-hielo">{leyenda}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl border border-hielo/25 bg-marino/70 p-1">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className="relative flex min-h-11 flex-1 basis-0 cursor-pointer items-center justify-center rounded-lg px-4 text-center font-semibold text-hielo transition-colors duration-150 hover:bg-hielo/10 has-checked:bg-hielo has-checked:text-marino has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-hielo"
          >
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => alCambiar(o.valor)}
              className="sr-only"
            />
            {o.etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
