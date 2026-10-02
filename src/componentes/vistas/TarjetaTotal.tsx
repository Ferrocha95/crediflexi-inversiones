import type { ReactNode } from "react";
import { TarjetaCifra } from "../ui/TarjetaCifra";
import { TarjetaVidrio } from "../ui/TarjetaVidrio";

export interface PropsTarjetaTotal {
  readonly etiqueta: ReactNode;
  /** El total ya calculado y formateado por quien llama. */
  readonly valor: string;
  /** Desglose o nota bajo la cifra. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/** Total destacado: vidrio, número animado en verde y la flecha de la marca. */
export function TarjetaTotal({ etiqueta, valor, children, className = "" }: PropsTarjetaTotal) {
  return (
    <TarjetaVidrio className={className}>
      <TarjetaCifra etiqueta={etiqueta} valor={valor} tono="positivo" tamano="grande" flecha>
        {children}
      </TarjetaCifra>
    </TarjetaVidrio>
  );
}
