import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { componer, contraste } from "../../../src/componentes/diseno/contraste";
import { COLOR, VIDRIO } from "../../../src/componentes/diseno/tokens";

// Contraste WCAG 2.2 de las parejas texto/fondo del sistema de diseño. axe no
// sabe calcularlo sobre backdrop-filter, así que el vidrio se revisa aquí con
// el peor fondo posible detrás.

const TEXTO_NORMAL = 4.5;
const TEXTO_GRANDE = 3;

/** El fondo más claro que puede quedar detrás del vidrio: el punto alto del degradado de la página. */
const PEOR_FONDO_VIDRIO = componer(VIDRIO.tinte, VIDRIO.opacidad, COLOR.marinoAlto);
/** La barra inferior flota sobre el contenido; lo más claro que puede pasar debajo es la fila amarilla del pipeline. */
const PEOR_FONDO_BARRA = componer(VIDRIO.tinteBarra, VIDRIO.opacidadBarra, COLOR.estatusIntermitente);

describe("función de contraste", () => {
  it("blanco sobre negro da 21:1 y un color contra sí mismo da 1:1", () => {
    expect(contraste("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contraste("#012553", "#012553")).toBeCloseTo(1, 5);
  });

  it("componer con opacidad 1 deja el color y con 0 deja el fondo", () => {
    expect(componer("#0E396D", 1, "#FFFFFF")).toBe("#0E396D");
    expect(componer("#0E396D", 0, "#FFFFFF")).toBe("#FFFFFF");
  });

  it("rechaza un color mal escrito con un mensaje claro", () => {
    expect(() => contraste("azul", "#FFFFFF")).toThrow(/Color inválido/);
  });
});

describe("texto normal (4.5:1 o más)", () => {
  const fondos = {
    marino: COLOR.marino,
    marinoLogo: COLOR.marinoLogo,
    marinoAlto: COLOR.marinoAlto,
    "vidrio en el peor caso": PEOR_FONDO_VIDRIO,
  };
  const textos = {
    blanco: COLOR.blanco,
    hielo: COLOR.hielo,
    hieloTenue: COLOR.hieloTenue,
    verdeTexto: COLOR.verdeTexto,
    amarillo: COLOR.amarillo,
  };
  for (const [nombreTexto, texto] of Object.entries(textos)) {
    for (const [nombreFondo, fondo] of Object.entries(fondos)) {
      it(`${nombreTexto} sobre ${nombreFondo}`, () => {
        expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
      });
    }
  }

  it("blanco y hielo sobre la barra inferior con la fila amarilla debajo", () => {
    expect(contraste(COLOR.blanco, PEOR_FONDO_BARRA)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
    expect(contraste(COLOR.hielo, PEOR_FONDO_BARRA)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
  });

  it("marino sobre los tres colores de estatus del pipeline", () => {
    for (const fondo of [COLOR.estatusInteresado, COLOR.estatusIntermitente, COLOR.estatusNoInteresado]) {
      expect(contraste(COLOR.marino, fondo)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
    }
  });

  it("marino sobre el botón primario (hielo)", () => {
    expect(contraste(COLOR.marino, COLOR.hielo)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
  });

  it("el error claro sobre marino y sobre marinoAlto", () => {
    expect(contraste(COLOR.errorTexto, COLOR.marino)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
    expect(contraste(COLOR.errorTexto, COLOR.marinoAlto)).toBeGreaterThanOrEqual(TEXTO_NORMAL);
  });
});

describe("verde de marca: solo texto grande", () => {
  it("#00A010 no alcanza 4.5:1 sobre marino (por eso existe verdeTexto)", () => {
    expect(contraste(COLOR.verde, COLOR.marino)).toBeLessThan(TEXTO_NORMAL);
  });

  it("#00A010 sí alcanza 3:1 como texto grande sobre marino y sobre el vidrio", () => {
    expect(contraste(COLOR.verde, COLOR.marino)).toBeGreaterThanOrEqual(TEXTO_GRANDE);
    expect(contraste(COLOR.verde, PEOR_FONDO_VIDRIO)).toBeGreaterThanOrEqual(TEXTO_GRANDE);
  });
});

describe("los tokens de TypeScript son los mismos de globals.css", () => {
  const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  for (const [nombre, hex] of Object.entries(COLOR)) {
    it(`--color-${kebab(nombre)} es ${hex}`, () => {
      expect(css).toMatch(new RegExp(`--color-${kebab(nombre)}:\\s*${hex};`, "i"));
    });
  }
});
