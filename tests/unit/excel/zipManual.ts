import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { createDeflateRaw, crc32, deflateRawSync } from "node:zlib";

// ZIP armado a mano, SOLO para las pruebas: permite fabricar archivos
// alterados (tamaños falsos, encabezados que se contradicen, ZIP64, cifrado,
// datos pegados al final…) que ninguna herramienta normal generaría.
// Estructura según la especificación APPNOTE de PKWARE.

export interface EntradaManual {
  readonly nombre: string;
  /** Contenido sin comprimir. Se omite si se da `comprimido`. */
  readonly contenido?: Uint8Array;
  /** Datos ya comprimidos con deflate (para bombas sin tener todo en memoria). */
  readonly comprimido?: Uint8Array;
  /** 0 = guardado sin compresión, 8 = deflate. Por omisión, 8. */
  readonly metodo?: 0 | 8;
  /** Tamaño descomprimido que se DECLARA (en el encabezado local y en el directorio). */
  readonly declarado?: number;
  readonly banderas?: number;
  /** Nombre distinto en el encabezado local (para contradecir al directorio). */
  readonly nombreLocal?: string;
  /** Método distinto en el encabezado local. */
  readonly metodoLocal?: number;
  /** Método que se ESCRIBE en los dos encabezados (los datos siguen guardados o en deflate). */
  readonly metodoEscrito?: number;
  /** Marca la entrada como ZIP64 (tamaños 0xFFFFFFFF y campo extra 0x0001). */
  readonly zip64?: boolean;
}

export interface OpcionesManual {
  readonly comentario?: string;
  readonly datosAlFinal?: Uint8Array;
  /** Agrega una copia del registro de fin de directorio al final. */
  readonly finDuplicado?: boolean;
  /** Número de entradas que declara el registro de fin (por omisión, el real). */
  readonly totalDeclarado?: number;
}

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};

export function armarZip(entradas: readonly EntradaManual[], opciones: OpcionesManual = {}): Uint8Array {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;

  for (const e of entradas) {
    const metodo = e.metodo ?? 8;
    const contenido = e.contenido ?? new Uint8Array();
    const datos = Buffer.from(e.comprimido ?? (metodo === 8 ? deflateRawSync(contenido) : contenido));
    const crc = e.comprimido === undefined ? crc32(contenido) : 0;
    const declarado = e.declarado ?? contenido.length;
    const nombre = Buffer.from(e.nombre, "utf8");
    const nombreLocal = Buffer.from(e.nombreLocal ?? e.nombre, "utf8");
    const banderas = e.banderas ?? 0;
    const extra = e.zip64 ? Buffer.concat([u16(0x0001), u16(16), Buffer.alloc(8), Buffer.alloc(8)]) : Buffer.alloc(0);
    const tamComp = e.zip64 ? 0xffffffff : datos.length;
    const tamDesc = e.zip64 ? 0xffffffff : declarado;

    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(banderas), u16(e.metodoLocal ?? e.metodoEscrito ?? metodo), u16(0), u16(0x21),
      u32(crc), u32(tamComp), u32(tamDesc), u16(nombreLocal.length), u16(extra.length), nombreLocal, extra, datos,
    ]);
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(banderas), u16(e.metodoEscrito ?? metodo), u16(0), u16(0x21),
      u32(crc), u32(tamComp), u32(tamDesc), u16(nombre.length), u16(extra.length), u16(0), u16(0), u16(0), u32(0),
      u32(desplazamiento), nombre, extra,
    ]);
    locales.push(local);
    centrales.push(central);
    desplazamiento += local.length;
  }

  const directorio = Buffer.concat(centrales);
  const comentario = Buffer.from(opciones.comentario ?? "", "latin1");
  const total = opciones.totalDeclarado ?? entradas.length;
  const fin = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(total), u16(total), u32(directorio.length), u32(desplazamiento), u16(comentario.length), comentario,
  ]);
  return new Uint8Array(
    Buffer.concat([...locales, directorio, fin, opciones.finDuplicado ? fin : Buffer.alloc(0), Buffer.from(opciones.datosAlFinal ?? new Uint8Array())]),
  );
}

/**
 * Deflate de `megas` MB de ceros, comprimido por partes de 1 MB: nunca hay
 * más de 1 MB de ceros en memoria. 60 MB de ceros quedan en unos 60 KB.
 */
export async function cerosComprimidos(megas: number): Promise<Buffer> {
  const mega = Buffer.alloc(1024 * 1024);
  async function* ceros() {
    for (let i = 0; i < megas; i++) yield mega;
  }
  return buffer(Readable.from(ceros()).pipe(createDeflateRaw()));
}

/** Un .xlsx mínimo (no hace falta que ExcelJS lo abra: la revisión ocurre antes). */
export const BASICO: readonly EntradaManual[] = [
  { nombre: "[Content_Types].xml", contenido: Buffer.from("<Types/>") },
  { nombre: "xl/workbook.xml", contenido: Buffer.from("<workbook/>") },
];
