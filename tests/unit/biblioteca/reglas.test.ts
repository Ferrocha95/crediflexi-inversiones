import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORIAS,
  LARGO_DESCRIPCION,
  LARGO_ENLACE,
  LARGO_NOMBRE,
  MENSAJES_BIBLIOTECA,
  TIPOS,
  TOPE_BYTES,
  extensionDe,
  firmaCoincide,
  limpiarNombreArchivo,
  limpiarTexto,
  revisarTamano,
  tipoPorNombre,
  validarEnlace,
  validarMetadatos,
} from "../../../src/aplicacion/biblioteca/reglas";

// Reglas de la Biblioteca sin servidor: tipos por extensión Y por los primeros
// bytes (nunca por el tipo que declara el navegador), tamaño real, nombre
// limpio, enlaces https y datos sensibles. Todo con bytes sintéticos.

const ascii = (texto: string) => new TextEncoder().encode(texto);
const unir = (...partes: (Uint8Array | number[])[]) => {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.length;
  }
  return salida;
};
const relleno = (n: number) => new Uint8Array(n).fill(0x41);

// Firma correcta de cada tipo binario (seguida de relleno).
const FIRMAS: Record<"pdf" | "png" | "jpg" | "webp" | "gif" | "mp4" | "webm", Uint8Array> = {
  pdf: unir(ascii("%PDF-1.7\n"), relleno(32)),
  png: unir([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], relleno(32)),
  jpg: unir([0xff, 0xd8, 0xff, 0xe0], relleno(32)),
  webp: unir(ascii("RIFF"), [0x24, 0, 0, 0], ascii("WEBPVP8 "), relleno(32)),
  gif: unir(ascii("GIF89a"), relleno(32)),
  mp4: unir([0, 0, 0, 0x18], ascii("ftypisom"), relleno(32)),
  webm: unir([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84], ascii("webm"), relleno(32)),
};

describe("Biblioteca: topes iguales a los de la migración", () => {
  const migracion = readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "20261014120000_biblioteca.sql"),
    "utf8",
  );

  it("nombre 150, descripción 500, enlace 500 y 26,214,400 bytes", () => {
    expect(migracion).toContain(`char_length(nombre) <= ${LARGO_NOMBRE}`);
    expect(migracion).toContain(`char_length(descripcion) <= ${LARGO_DESCRIPCION}`);
    expect(migracion).toContain(`char_length(enlace) <= ${LARGO_ENLACE}`);
    expect(migracion).toContain(`tamano_bytes between 1 and ${TOPE_BYTES}`);
    expect(TOPE_BYTES).toBe(25 * 1024 * 1024);
  });

  it("las 4 categorías del enum", () => {
    const bloque = /create type public\.categoria_biblioteca as enum \(([^)]*)\)/.exec(migracion)![1];
    expect([...bloque.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])).toEqual([...CATEGORIAS]);
  });

  it("los 12 tipos MIME de la tabla y del bucket, y las 12 extensiones de la ruta", () => {
    const mimes = Object.values(TIPOS).map((t) => t.mime).sort();
    const tabla = /tipo_mime in \(([^)]*)\)/.exec(migracion)![1];
    expect([...tabla.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual(mimes);
    const bucket = /array\[([^\]]*)\]\s*\);/.exec(migracion)![1];
    expect([...bucket.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual(mimes);
    const extensiones = /\\\.\(([a-z0-9|]+)\)\$/.exec(migracion)![1].split("|").sort();
    expect(extensiones).toEqual(Object.keys(TIPOS).sort());
  });
});

describe("tipoPorNombre: solo los 12 tipos permitidos", () => {
  it.each([
    ["manual.pdf", "pdf"],
    ["FOTO.PNG", "png"],
    ["foto.jpg", "jpg"],
    ["foto.jpeg", "jpg"],
    ["imagen.webp", "webp"],
    ["animacion.gif", "gif"],
    ["video.mp4", "mp4"],
    ["video.webm", "webm"],
    ["guia.docx", "docx"],
    ["tabla.xlsx", "xlsx"],
    ["presentacion.pptx", "pptx"],
    ["notas.txt", "txt"],
    ["lista.csv", "csv"],
  ])("%s se acepta como %s", (nombre, ext) => {
    expect(tipoPorNombre(nombre)).toEqual({ ok: true, ext });
  });

  it.each([
    "instalador.exe",
    "script.js",
    "script.ps1",
    "script.bat",
    "script.sh",
    "pagina.html",
    "pagina.htm",
    "dibujo.svg",
    "paquete.zip",
    "archivo.rar",
    "viejo.doc",
    "viejo.xls",
    "viejo.ppt",
    "macros.docm",
    "macros.xlsm",
    "macros.pptm",
    "documento.rtf",
    "sin-extension",
    "terminado-en-punto.",
  ])("%s se rechaza", (nombre) => {
    const r = tipoPorNombre(nombre);
    expect(r.ok).toBe(false);
  });

  it("los de Office viejos o con macros piden guardarlo como .docx, .xlsx o .pptx", () => {
    for (const nombre of ["a.doc", "a.xls", "a.ppt", "a.docm", "a.xlsm", "a.pptm"]) {
      const r = tipoPorNombre(nombre);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensaje).toBe(MENSAJES_BIBLIOTECA.officeViejoOMacros);
    }
  });

  it("el mensaje de un tipo bloqueado dice cuáles se aceptan", () => {
    const r = tipoPorNombre("dibujo.svg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toMatch(/PDF.*PNG.*JPG.*WEBP.*GIF.*MP4.*WEBM.*DOCX.*XLSX.*PPTX.*TXT.*CSV/);
  });

  it("extensionDe toma solo la última extensión, en minúsculas", () => {
    expect(extensionDe("reporte.final.PDF")).toBe("pdf");
    expect(extensionDe("factura.pdf.exe")).toBe("exe");
    expect(extensionDe("sin_punto")).toBeNull();
  });
});

describe("firmaCoincide: los primeros bytes, nunca el tipo que declara el navegador", () => {
  for (const [ext, bytes] of Object.entries(FIRMAS) as [keyof typeof FIRMAS, Uint8Array][]) {
    it(`${ext} con su firma correcta se acepta`, () => {
      expect(firmaCoincide(ext, bytes)).toBe(true);
    });

    it(`${ext} con una firma falsa se rechaza`, () => {
      expect(firmaCoincide(ext, unir(ascii("MZ"), relleno(64)))).toBe(false);
    });
  }

  it("extensión engañosa: un ejecutivo (MZ) llamado .pdf se rechaza", () => {
    expect(firmaCoincide("pdf", unir(ascii("MZ\x90\x00"), relleno(64)))).toBe(false);
  });

  it("extensión engañosa: un PDF llamado .png se rechaza, y un PNG llamado .jpg también", () => {
    expect(firmaCoincide("png", FIRMAS.pdf)).toBe(false);
    expect(firmaCoincide("jpg", FIRMAS.png)).toBe(false);
  });

  it("extensión engañosa: HTML llamado .txt se acepta como texto plano, pero un SVG llamado .png no", () => {
    // Un .txt es texto: se descarga como adjunto text/plain con nosniff.
    expect(firmaCoincide("txt", ascii("<html><script>alert(1)</script></html>"))).toBe(true);
    expect(firmaCoincide("png", ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(false);
  });

  it("un Matroska que no es WEBM se rechaza como .webm", () => {
    expect(firmaCoincide("webm", unir([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88], ascii("matroska"), relleno(32)))).toBe(false);
  });

  it("un RIFF que no es WEBP (WAVE) se rechaza como .webp", () => {
    expect(firmaCoincide("webp", unir(ascii("RIFF"), [0x24, 0, 0, 0], ascii("WAVEfmt "), relleno(32)))).toBe(false);
  });

  it("GIF87a también es GIF", () => {
    expect(firmaCoincide("gif", unir(ascii("GIF87a"), relleno(8)))).toBe(true);
  });

  it("archivos más cortos que la firma se rechazan", () => {
    expect(firmaCoincide("png", new Uint8Array([0x89, 0x50]))).toBe(false);
    expect(firmaCoincide("mp4", new Uint8Array([0, 0, 0]))).toBe(false);
  });

  it("TXT y CSV: texto UTF-8 válido, con acentos y BOM, se acepta", () => {
    expect(firmaCoincide("txt", ascii("Guía de capacitación\nLínea 2"))).toBe(true);
    expect(firmaCoincide("csv", unir([0xef, 0xbb, 0xbf], ascii("nombre,sucursal\nAna,Centro\n")))).toBe(true);
  });

  it("TXT y CSV con un byte nulo se rechazan", () => {
    expect(firmaCoincide("txt", unir(ascii("hola"), [0], ascii("mundo")))).toBe(false);
    expect(firmaCoincide("csv", unir(ascii("a,b"), [0]))).toBe(false);
  });

  it("TXT y CSV que no son UTF-8 válido (Latin-1) se rechazan", () => {
    expect(firmaCoincide("txt", new Uint8Array([0x47, 0x75, 0xed, 0x61]))).toBe(false);
  });

  it("un ejecutivo llamado .txt se rechaza (bytes nulos)", () => {
    expect(firmaCoincide("txt", unir(ascii("MZ"), [0x90, 0, 0x03, 0], relleno(16)))).toBe(false);
  });
});

describe("revisarTamano: bytes reales", () => {
  it("26,214,400 bytes se aceptan", () => {
    expect(revisarTamano(26_214_400)).toBeNull();
  });

  it("26,214,401 bytes se rechazan y el mensaje sugiere agregar los videos como enlace", () => {
    expect(revisarTamano(26_214_401)).toBe(MENSAJES_BIBLIOTECA.muyGrande);
    expect(MENSAJES_BIBLIOTECA.muyGrande).toMatch(/25 MB/);
    expect(MENSAJES_BIBLIOTECA.muyGrande).toMatch(/enlace/);
  });

  it("un archivo vacío se rechaza", () => {
    expect(revisarTamano(0)).toBe(MENSAJES_BIBLIOTECA.vacio);
  });
});

describe("limpiarNombreArchivo", () => {
  it("quita las carpetas con / y con \\", () => {
    expect(limpiarNombreArchivo("../../etc/manual.pdf")).toBe("manual.pdf");
    expect(limpiarNombreArchivo("C:\\Users\\alguien\\Documentos\\guia.docx")).toBe("guia.docx");
    expect(limpiarNombreArchivo("carpeta/sub\\otra/../final.xlsx")).toBe("final.xlsx");
  });

  it("quita caracteres de control", () => {
    expect(limpiarNombreArchivo("man\u0000ual\u0007\u001b.pdf")).toBe("manual.pdf");
    expect(limpiarNombreArchivo("linea\r\nnueva.txt")).toBe("lineanueva.txt");
  });

  it("quita caracteres invisibles: espacio de ancho cero, BOM, marcas de dirección y relleno hangul", () => {
    expect(limpiarNombreArchivo("ma\u200Bnu\u200Cal\u200D\uFEFF.pdf")).toBe("manual.pdf");
    // U+202E invierte el texto: "factura\u202Efdp.exe" se vería como "facturaexe.pdf".
    expect(limpiarNombreArchivo("factura\u202Efdp.exe")).toBe("facturafdp.exe");
    expect(limpiarNombreArchivo("a\u2066b\u2069c\u061C\u3164\u115F.png")).toBe("abc.png");
  });

  it("los espacios raros se vuelven espacios normales y se recortan", () => {
    expect(limpiarNombreArchivo("  Guía\u00A0de\u2003ventas   2026 .pdf  ")).toBe("Guía de ventas 2026 .pdf");
  });

  it("normaliza a NFC (la é compuesta y la descompuesta son la misma)", () => {
    expect(limpiarNombreArchivo("cafe\u0301.txt")).toBe("caf\u00e9.txt");
  });

  it("quita los puntos del inicio (archivos ocultos)", () => {
    expect(limpiarNombreArchivo("...oculto.txt")).toBe("oculto.txt");
  });

  it("el limpio de un nombre que solo trae carpetas o invisibles queda vacío", () => {
    expect(limpiarNombreArchivo("carpeta/")).toBe("");
    expect(limpiarNombreArchivo("\u200B\u200B")).toBe("");
  });

  it("un nombre largo se corta a 150 caracteres conservando la extensión", () => {
    const limpio = limpiarNombreArchivo(`${"a".repeat(300)}.pdf`);
    expect(limpio).toHaveLength(LARGO_NOMBRE);
    expect(limpio.endsWith(".pdf")).toBe(true);
  });

  it("limpiarTexto conserva los saltos de línea pero quita controles e invisibles", () => {
    expect(limpiarTexto("Línea 1\nLínea\u200B 2\u0007")).toBe("Línea 1\nLínea 2");
    expect(limpiarTexto("a\r\nb")).toBe("a\nb");
  });
});

describe("validarEnlace: solo https, sin usuario ni contraseña", () => {
  it("acepta https y devuelve la URL normalizada y el dominio visible", () => {
    expect(validarEnlace("  https://Videos.Ejemplo.test/capacitacion?id=1  ")).toEqual({
      ok: true,
      url: "https://videos.ejemplo.test/capacitacion?id=1",
      dominio: "videos.ejemplo.test",
    });
  });

  it("un dominio con acentos se muestra en punycode, como lo verá el navegador", () => {
    const r = validarEnlace("https://capacitación.ejemplo.test/");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dominio).toBe("xn--capacitacin-zeb.ejemplo.test");
  });

  it.each([
    ["un enlace http", "http://videos.ejemplo.test/x"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<p>hola</p>"],
    ["ftp", "ftp://ejemplo.test/x"],
    ["con usuario y contraseña", "https://usuario:clave@videos.ejemplo.test/x"],
    ["con usuario", "https://usuario@videos.ejemplo.test/x"],
    ["sin dominio", "https://"],
    ["texto que no es URL", "mi video de capacitación"],
    ["vacío", "   "],
    ["una IP entre corchetes", "https://[::1]/x"],
  ])("rechaza %s", (_caso, texto) => {
    expect(validarEnlace(texto).ok).toBe(false);
  });

  it("500 caracteres se aceptan y 501 se rechazan", () => {
    // "https://ejemplo.test/" mide 21 caracteres.
    expect(validarEnlace(`https://ejemplo.test/${"a".repeat(479)}`).ok).toBe(true);
    expect(validarEnlace(`https://ejemplo.test/${"a".repeat(480)}`).ok).toBe(false);
  });

  it("rechaza lo que no es texto", () => {
    expect(validarEnlace(42).ok).toBe(false);
    expect(validarEnlace(null).ok).toBe(false);
  });
});

describe("validarMetadatos", () => {
  const base = { nombre: "Manual de ventas", descripcion: "Guía para el equipo.", categoria: "CAPACITACION" };

  it("acepta datos válidos y limpia el nombre y la descripción", () => {
    expect(validarMetadatos({ ...base, nombre: "  Manual\u200B de ventas " })).toEqual({
      ok: true,
      valor: { nombre: "Manual de ventas", descripcion: "Guía para el equipo.", categoria: "CAPACITACION" },
    });
  });

  it("la descripción es opcional", () => {
    const r = validarMetadatos({ ...base, descripcion: undefined });
    expect(r.ok && r.valor.descripcion).toBe("");
  });

  it.each(CATEGORIAS.map((c) => [c]))("acepta la categoría %s", (categoria) => {
    expect(validarMetadatos({ ...base, categoria }).ok).toBe(true);
  });

  it("rechaza una categoría que no existe", () => {
    const r = validarMetadatos({ ...base, categoria: "OTRA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.categoria).toBeDefined();
  });

  it("rechaza un nombre vacío o de solo invisibles", () => {
    for (const nombre of ["", "   ", "\u200B"]) {
      const r = validarMetadatos({ ...base, nombre });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errores.nombre).toBeDefined();
    }
  });

  it("150 caracteres en el nombre se aceptan y 151 se rechazan", () => {
    expect(validarMetadatos({ ...base, nombre: "N".repeat(150) }).ok).toBe(true);
    expect(validarMetadatos({ ...base, nombre: "N".repeat(151) }).ok).toBe(false);
  });

  it("500 caracteres en la descripción se aceptan y 501 se rechazan", () => {
    expect(validarMetadatos({ ...base, descripcion: "d".repeat(500) }).ok).toBe(true);
    expect(validarMetadatos({ ...base, descripcion: "d".repeat(501) }).ok).toBe(false);
  });

  it("dato sensible en el nombre: una CLABE", () => {
    const r = validarMetadatos({ ...base, nombre: "Cuenta 012180001234567891" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.nombre).toMatch(/CLABE/);
  });

  it("dato sensible en la descripción: un RFC y una CURP", () => {
    for (const descripcion of ["Contrato de GODE561231GR8", "Copia de GODE561231HDFRRN09"]) {
      const r = validarMetadatos({ ...base, descripcion });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errores.descripcion).toBeDefined();
    }
  });

  it("18 dígitos repartidos entre el nombre y la descripción también se rechazan, como en la base", () => {
    const r = validarMetadatos({ ...base, nombre: "Lista 012180001", descripcion: "234567891" });
    expect(r.ok).toBe(false);
  });

  it("rechaza lo que no es texto", () => {
    expect(validarMetadatos({ ...base, nombre: 7 }).ok).toBe(false);
    expect(validarMetadatos(null).ok).toBe(false);
  });
});
