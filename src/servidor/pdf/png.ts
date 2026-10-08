/** Firma de 8 bytes con la que empieza todo PNG. */
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Ancho y alto en píxeles, leídos del encabezado IHDR del PNG (bytes 16 a 23).
 * Así la proporción del logo no vive en el código: si se reemplaza el archivo
 * por otro de distinta medida, el PDF lo dibuja sin deformarlo.
 */
export function dimensionesPng(bytes: Uint8Array): { readonly ancho: number; readonly alto: number } {
  const esPng = bytes.length >= 24 && FIRMA_PNG.every((b, i) => bytes[i] === b) && String.fromCharCode(...bytes.subarray(12, 16)) === "IHDR";
  if (!esPng) {
    throw new Error("El archivo del logo no es un PNG válido. Reemplázalo por una imagen PNG y vuelve a generar el PDF.");
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { ancho: vista.getUint32(16), alto: vista.getUint32(20) };
}
