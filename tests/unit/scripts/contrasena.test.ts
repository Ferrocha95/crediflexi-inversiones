import { describe, expect, it } from "vitest";
import { generarContrasena, LARGO_CONTRASENA } from "../../../scripts/contrasena.mjs";

// Las contraseñas generadas (pruebas RLS, e2e y scripts) deben pasar la regla
// de supabase/config.toml: 12 caracteres como mínimo y minúscula, mayúscula y dígito.
const MUESTRAS = 1000;

describe("generarContrasena", () => {
  const muestras: string[] = Array.from({ length: MUESTRAS }, () => generarContrasena());

  it("el largo por omisión es de 12 caracteres o más", () => {
    expect(LARGO_CONTRASENA).toBeGreaterThanOrEqual(12);
  });

  it(`en ${MUESTRAS} muestras: largo mínimo 12, y siempre minúscula, mayúscula y dígito`, () => {
    for (const c of muestras) {
      expect(c.length).toBeGreaterThanOrEqual(12);
      expect(c).toMatch(/[a-z]/);
      expect(c).toMatch(/[A-Z]/);
      expect(c).toMatch(/[0-9]/);
    }
  });

  it("solo usa letras ASCII y dígitos", () => {
    for (const c of muestras) expect(c).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("no repite contraseñas", () => {
    expect(new Set(muestras).size).toBe(MUESTRAS);
  });

  it("las tres clases no quedan siempre al principio (se barajan)", () => {
    const primeras = new Set(muestras.map((c) => (/[a-z]/.test(c[0]) ? "min" : /[A-Z]/.test(c[0]) ? "may" : "dig")));
    expect(primeras.size).toBe(3);
  });

  it("acepta un largo mayor y rechaza uno menor a 12", () => {
    expect(generarContrasena(40)).toHaveLength(40);
    expect(() => generarContrasena(11)).toThrow(/12/);
  });
});
