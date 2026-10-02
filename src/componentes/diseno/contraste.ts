/**
 * Contraste WCAG 2.2 entre dos colores. Solo se usa para revisar el sistema de
 * diseño en las pruebas: no es dinero, así que trabaja con number.
 */

const RE_HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function canales(hex: string): [number, number, number] {
  const m = RE_HEX.exec(hex);
  if (m === null) throw new Error(`Color inválido: "${hex}". Escríbelo como #RRGGBB, por ejemplo #012553.`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function luminancia(hex: string): number {
  const [r, g, b] = canales(hex).map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Color que resulta de poner `frente` con la opacidad dada sobre `fondo`. */
export function componer(frente: string, opacidad: number, fondo: string): string {
  const f = canales(frente);
  const b = canales(fondo);
  const hex = f.map((c, i) =>
    Math.round(c * opacidad + b[i] * (1 - opacidad))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase(),
  );
  return `#${hex.join("")}`;
}
