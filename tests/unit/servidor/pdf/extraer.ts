import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface TextoPdf {
  readonly paginas: number;
  /** Texto de todas las páginas, con los espacios y saltos de línea juntados en un espacio. */
  readonly texto: string;
  /** El texto de cada página, con el mismo tratamiento. */
  readonly porPagina: readonly string[];
}

const juntar = (partes: readonly string[]) => partes.join("").replace(/\s+/g, " ").trim();

/** Extrae el texto de un PDF con pdfjs-dist (solo en pruebas). */
export async function extraerTexto(bytes: Uint8Array): Promise<TextoPdf> {
  const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const pdf = await tarea.promise;
  const porPagina: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const contenido = await (await pdf.getPage(i)).getTextContent();
    const partes: string[] = [];
    for (const item of contenido.items) {
      if ("str" in item) partes.push(item.str + (item.hasEOL ? " " : ""));
    }
    porPagina.push(juntar(partes));
  }
  const paginas = pdf.numPages;
  await tarea.destroy();
  return { paginas, texto: juntar(porPagina.map((p) => `${p} `)), porPagina };
}

/** Dibuja una página del PDF en PNG con pdfjs-dist y @napi-rs/canvas (ya instalados para pruebas). */
export async function paginaEnPng(bytes: Uint8Array, numero: number, escala: number): Promise<Buffer> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const pdf = await tarea.promise;
  const pagina = await pdf.getPage(numero);
  const vista = pagina.getViewport({ scale: escala });
  const lienzo = createCanvas(Math.ceil(vista.width), Math.ceil(vista.height));
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#FFFFFF";
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  await pagina.render({
    canvasContext: contexto as unknown as CanvasRenderingContext2D,
    canvas: lienzo as unknown as HTMLCanvasElement,
    viewport: vista,
  }).promise;
  await tarea.destroy();
  return lienzo.encode("png");
}

/** Cada texto de una página con su tamaño de letra en puntos (escala de la matriz de texto). */
export async function textosConTamano(bytes: Uint8Array, numero: number): Promise<readonly { readonly texto: string; readonly tamano: number }[]> {
  const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const contenido = await (await (await tarea.promise).getPage(numero)).getTextContent();
  const items = contenido.items.flatMap((item) =>
    "str" in item && item.str.trim() !== "" ? [{ texto: item.str, tamano: Math.hypot(item.transform[0], item.transform[1]) }] : [],
  );
  await tarea.destroy();
  return items;
}

/** Las imágenes que se pintan en cada página, con su tamaño en píxeles (la máscara de transparencia no cuenta). */
export async function imagenesPorPagina(bytes: Uint8Array): Promise<readonly (readonly { readonly ancho: number; readonly alto: number }[])[]> {
  const { OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const tarea = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const pdf = await tarea.promise;
  const resultado: { ancho: number; alto: number }[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const ops = await pagina.getOperatorList();
    const imagenes: { ancho: number; alto: number }[] = [];
    for (const [j, f] of ops.fnArray.entries()) {
      if (f !== OPS.paintImageXObject) continue;
      const id = ops.argsArray[j][0] as string;
      // Las imágenes que se repiten entre páginas viven en commonObjs (id "g_..."); las demás, en objs.
      const objetos = id.startsWith("g_") ? pagina.commonObjs : pagina.objs;
      const img = await new Promise<{ width: number; height: number }>((r) => objetos.get(id, r));
      imagenes.push({ ancho: img.width, alto: img.height });
    }
    resultado.push(imagenes);
  }
  await tarea.destroy();
  return resultado;
}
