import "server-only";

export type LecturaConTope =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly motivo: "grande" | "incompleto" };

/**
 * Lee un cuerpo en stream contando los bytes, sin request.arrayBuffer() (que
 * no tiene tope). En cuanto el total pasa de `tope` (es decir, al llegar al
 * byte tope + 1) cancela la lectura y responde "grande". Si el stream falla a
 * medias, "incompleto".
 */
export async function leerConTope(cuerpo: ReadableStream<Uint8Array> | null, tope: number): Promise<LecturaConTope> {
  if (cuerpo === null) return { ok: true, bytes: new Uint8Array() };
  const lector = cuerpo.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > tope) {
        await lector.cancel().catch(() => undefined);
        return { ok: false, motivo: "grande" };
      }
      partes.push(value);
    }
  } catch {
    return { ok: false, motivo: "incompleto" };
  } finally {
    lector.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    bytes.set(p, i);
    i += p.length;
  }
  return { ok: true, bytes };
}
