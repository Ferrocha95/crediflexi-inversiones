import { useId } from "react";

/**
 * La flecha ascendente del logo como línea fina: rojo, naranja y amarillo de
 * marca (los mismos de la línea decorativa del PDF). Es decoración: aria-hidden.
 */
export function LineaFlecha({ className = "" }: { readonly className?: string }) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 28"
      preserveAspectRatio="none"
      className={`block h-7 w-full ${className}`}
    >
      <defs>
        <linearGradient id={`${id}-marca`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--color-rojo)" />
          <stop offset="0.5" stopColor="var(--color-naranja)" />
          <stop offset="1" stopColor="var(--color-amarillo)" />
        </linearGradient>
      </defs>
      <path
        d="M2 24 C 70 30, 150 26, 226 6"
        fill="none"
        stroke={`url(#${id}-marca)`}
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M216 4 L236 2 L229 20 Z" fill="var(--color-amarillo)" />
    </svg>
  );
}
