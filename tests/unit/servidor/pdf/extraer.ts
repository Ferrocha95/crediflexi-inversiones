import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface TextoPdf {
  readonly paginas: number;
  /** Texto de todas las páginas, con los espacios y saltos de línea juntados en un espacio. */
  readonly texto: string;
}

/** Extrae el texto de un PDF con pdfjs-dist (solo en pruebas). */
export async function extraerTexto(bytes: Uint8Array): Promise<TextoPdf> {
  const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const pdf = await tarea.promise;
  const partes: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const contenido = await (await pdf.getPage(i)).getTextContent();
    for (const item of contenido.items) {
      if ("str" in item) partes.push(item.str + (item.hasEOL ? " " : ""));
    }
    partes.push(" ");
  }
  const paginas = pdf.numPages;
  await tarea.destroy();
  return { paginas, texto: partes.join("").replace(/\s+/g, " ").trim() };
}
