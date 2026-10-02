import { CalendarDays, Calculator, Kanban, Library, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";

export interface Destino {
  readonly ruta: string;
  readonly etiqueta: string;
  /** Etiqueta corta para la barra inferior del celular. */
  readonly corta: string;
  readonly Icono: LucideIcon;
  /** false: se muestra como "Próximamente" y no navega. */
  readonly disponible: boolean;
}

/** Destinos del menú, en orden. Solo el cotizador existe hoy. */
export const DESTINOS: readonly Destino[] = [
  { ruta: "/cotizador", etiqueta: "Cotizador", corta: "Cotizador", Icono: Calculator, disponible: true },
  { ruta: "/pipeline", etiqueta: "Pipeline", corta: "Pipeline", Icono: Kanban, disponible: false },
  { ruta: "/plan-semanal", etiqueta: "Plan semanal", corta: "Plan", Icono: CalendarDays, disponible: false },
  { ruta: "/proyeccion", etiqueta: "Proyección", corta: "Proyección", Icono: TrendingUp, disponible: false },
  { ruta: "/metas", etiqueta: "Metas", corta: "Metas", Icono: Target, disponible: false },
  { ruta: "/cartera", etiqueta: "Cartera", corta: "Cartera", Icono: Wallet, disponible: false },
  { ruta: "/biblioteca", etiqueta: "Biblioteca", corta: "Biblioteca", Icono: Library, disponible: false },
];

/** Cuántos destinos caben en la barra inferior del celular; el resto va en "Más". */
export const EN_BARRA = 4;

/** true si la ruta actual pertenece al destino (la ruta misma o una subruta). */
export function esDestinoActual(ruta: string, actual: string): boolean {
  return actual === ruta || actual.startsWith(`${ruta}/`);
}
