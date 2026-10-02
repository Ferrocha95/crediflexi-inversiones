import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { CLASE_CONTROL } from "./Campo";

/** <select> nativo con estilo: conserva el teclado y el lector de pantalla del navegador. */
export function Selector({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={`${CLASE_CONTROL} cursor-pointer appearance-none pr-10 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-hielo"
      />
    </div>
  );
}
