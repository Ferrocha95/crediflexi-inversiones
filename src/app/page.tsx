import { Calculator } from "lucide-react";
import Link from "next/link";
import { LineaFlecha } from "../componentes/ui/LineaFlecha";

export default function Home() {
  return (
    <div className="flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-8">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-cifra">Mesa de captación</h1>
      <LineaFlecha className="max-w-72" />
      <p className="max-w-prose text-lg text-hielo">
        Por ahora solo está el cotizador. Pipeline, plan semanal, proyección y metas llegan en los siguientes sprints.
      </p>
      <Link
        href="/cotizador"
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-hielo px-5 font-bold text-marino transition-colors duration-150 hover:bg-blanco"
      >
        <Calculator aria-hidden="true" className="size-5" />
        Ir al cotizador
      </Link>
    </div>
  );
}
