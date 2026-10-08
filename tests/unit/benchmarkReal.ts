import benchmarkJson from "../../seed/benchmark.json";
import { cargarBenchmark } from "../../src/aplicacion/benchmark";

/** seed/benchmark.json ya validado, para las pruebas que arman el modelo del PDF. */
export const benchmarkReal = (() => {
  const r = cargarBenchmark(benchmarkJson, "seed/benchmark.json");
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
})();
