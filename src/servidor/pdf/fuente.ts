import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Nunito (SIL Open Font License 1.1, ver LICENCIA-Nunito-OFL.txt), instalada
 * con @fontsource/nunito. react-pdf solo lee TTF y WOFF: se usan los .woff del
 * subconjunto latin, que trae las vocales acentuadas, ñ, ü, ¿, ¡, ·, × y ÷.
 */
export const FAMILIA = "Nunito";

const archivo = (peso: 400 | 700) =>
  path.join(process.cwd(), "node_modules", "@fontsource", "nunito", "files", `nunito-latin-${peso}-normal.woff`);

/** Palabras más largas que esto se parten (solo pasa con texto sin espacios). */
const PALABRA_MAXIMA = 40;

let registrada = false;

/** Registra la fuente una sola vez por proceso. */
export function registrarFuente(): void {
  if (registrada) return;
  Font.register({
    family: FAMILIA,
    fonts: [
      { src: archivo(400), fontWeight: "normal" },
      { src: archivo(700), fontWeight: "bold" },
    ],
  });
  // Sin esto react-pdf parte las palabras con las reglas del inglés y agrega guiones.
  Font.registerHyphenationCallback((palabra) => {
    const letras = Array.from(palabra);
    if (letras.length <= PALABRA_MAXIMA) return [palabra];
    const partes: string[] = [];
    for (let i = 0; i < letras.length; i += PALABRA_MAXIMA) {
      partes.push(letras.slice(i, i + PALABRA_MAXIMA).join(""));
    }
    return partes;
  });
  registrada = true;
}
