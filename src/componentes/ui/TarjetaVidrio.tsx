import type { HTMLAttributes, ReactNode } from "react";

export interface PropsTarjetaVidrio extends HTMLAttributes<HTMLElement> {
  readonly como?: "div" | "section" | "article" | "aside";
  /** Eleva la tarjeta al pasar el cursor (solo para tarjetas que se pueden usar). */
  readonly interactiva?: boolean;
  readonly children: ReactNode;
}

/**
 * Tarjeta translúcida con desenfoque y borde fino. Úsala solo en lo importante:
 * no más de 3 o 4 capas con desenfoque por pantalla. Con transparencia
 * reducida (o sin backdrop-filter) se vuelve opaca.
 */
export function TarjetaVidrio({ como: Etiqueta = "div", interactiva = false, className = "", children, ...resto }: PropsTarjetaVidrio) {
  return (
    <Etiqueta
      className={`vidrio rounded-2xl p-5 shadow-[0_20px_50px_-24px_rgb(0_6_24/0.8)] sm:p-6 ${interactiva ? "elevable" : ""} ${className}`}
      {...resto}
    >
      {children}
    </Etiqueta>
  );
}
