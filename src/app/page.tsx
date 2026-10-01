import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-lg">En construcción</p>
      <Link href="/cotizador" className="rounded-md border border-current px-4 py-2 underline">
        Ir al cotizador
      </Link>
    </main>
  );
}
