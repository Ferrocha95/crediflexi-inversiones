import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvisoSesionExpirada } from "../../../src/componentes/acceso/AvisoSesionExpirada";
import { errorEsSesionExpirada, vistaPreviaSinSesion } from "../../../src/componentes/acceso/sesionExpirada";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { clasificarRespuestaPdf } from "../../../src/app/(app)/cotizador/peticionPdf";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("sesión expirada en peticiones que no son de navegación", () => {
  it("reconoce el error que Next arma con el 401 text/plain del proxy", () => {
    expect(errorEsSesionExpirada(new Error(MENSAJE_SESION_EXPIRADA))).toBe(true);
    expect(errorEsSesionExpirada(new Error("An unexpected response was received from the server."))).toBe(false);
    expect(errorEsSesionExpirada(new TypeError("Failed to fetch"))).toBe(false);
    expect(errorEsSesionExpirada(MENSAJE_SESION_EXPIRADA)).toBe(false);
  });

  it("reconoce la vista previa que la acción niega a un usuario sin sesión activa", () => {
    expect(vistaPreviaSinSesion({ tipo: "error", mensaje: MENSAJE_SESION_EXPIRADA })).toBe(true);
    expect(vistaPreviaSinSesion({ tipo: "error", mensaje: "El monto es ilegible." })).toBe(false);
    expect(vistaPreviaSinSesion({ tipo: "elige_plazo" })).toBe(false);
  });

  it.each([
    [200, "application/pdf", "pdf"],
    [401, "application/json", "sesion_expirada"],
    [401, "text/plain", "sesion_expirada"],
    [200, "text/html; charset=utf-8", "inesperada"],
    [200, null, "inesperada"],
    [422, "application/json", "error"],
    [500, "text/plain", "error"],
  ] as const)("respuesta del PDF %i %s es %s", (estado, tipo, esperado) => {
    expect(clasificarRespuestaPdf(estado, tipo)).toBe(esperado);
  });

  it("el aviso dice que la sesión expiró y enlaza a /acceso con la ruta de regreso", () => {
    const html = renderToStaticMarkup(createElement(AvisoSesionExpirada, { siguiente: "/cotizador" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(MENSAJE_SESION_EXPIRADA);
    expect(html).toContain('href="/acceso?siguiente=%2Fcotizador"');
  });

  it("el cotizador usa el aviso, clasifica la respuesta del PDF y reconoce el error de la acción", () => {
    const cotizador = leer("src/app/(app)/cotizador/Cotizador.tsx");
    expect(cotizador).toMatch(/<AvisoSesionExpirada/);
    expect(cotizador).toMatch(/clasificarRespuestaPdf\(/);
    expect(cotizador).toMatch(/errorEsSesionExpirada\(/);
    expect(cotizador).toMatch(/vistaPreviaSinSesion\(/);
  });
});
