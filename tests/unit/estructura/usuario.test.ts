import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// cerrarSesion es una acción del servidor; aquí solo importa que el botón la use.
vi.mock("../../../src/app/acceso/acciones", () => ({ cerrarSesion: async () => undefined }));

const { BloqueUsuario, EncabezadoUsuario, rolLegible, salirDeLaSesion } = await import(
  "../../../src/componentes/estructura/Usuario"
);

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

const USUARIO = { nombre: "Gerente Sintética Dos", rol: "GERENTE" as const, sucursal: "Sucursal Ficticia Centro" };

describe("rolLegible", () => {
  it.each([
    ["DIRECTOR_REGIONAL", "Director regional"],
    ["GERENTE", "Gerente"],
    ["EJECUTIVO", "Ejecutivo"],
  ] as const)("%s se lee %s", (rol, texto) => {
    expect(rolLegible(rol)).toBe(texto);
  });
});

describe("bloque del usuario en el menú y en el diálogo Más", () => {
  const html = renderToStaticMarkup(createElement(BloqueUsuario, { usuario: USUARIO }));

  it("muestra nombre, rol legible y sucursal", () => {
    expect(html).toContain("Gerente Sintética Dos");
    expect(html).toContain(">Gerente<");
    expect(html).toContain("Sucursal Ficticia Centro");
    expect(html).not.toContain("GERENTE");
  });

  it("el botón Cerrar sesión es un botón de envío dentro de un formulario", () => {
    expect(html).toMatch(/<form[^>]*>[\s\S]*<button[^>]*type="submit"[^>]*>[\s\S]*Cerrar sesión[\s\S]*<\/button>[\s\S]*<\/form>/);
  });
});

describe("encabezado del celular", () => {
  const html = renderToStaticMarkup(createElement(EncabezadoUsuario, { usuario: USUARIO }));

  it("muestra nombre, rol y sucursal, y un botón Cerrar sesión con nombre accesible", () => {
    expect(html).toContain("Gerente Sintética Dos");
    expect(html).toContain("Gerente · Sucursal Ficticia Centro");
    expect(html).toMatch(/<form[^>]*>[\s\S]*<button[^>]*type="submit"[^>]*aria-label="Cerrar sesión"/);
  });
});

describe("salirDeLaSesion", () => {
  it("cierra la sesión y navega a /acceso con una carga completa", async () => {
    const pasos: string[] = [];
    await salirDeLaSesion(
      async () => {
        pasos.push("cerrar");
      },
      (ruta) => pasos.push(`navegar ${ruta}`),
    );
    expect(pasos).toEqual(["cerrar", "navegar /acceso"]);
  });

  it("si la acción falla (por ejemplo, la sesión ya expiró y el proxy responde 401) igual lleva a /acceso", async () => {
    const pasos: string[] = [];
    await salirDeLaSesion(
      async () => {
        throw new Error("Tu sesión expiró; vuelve a iniciar sesión.");
      },
      (ruta) => pasos.push(`navegar ${ruta}`),
    );
    expect(pasos).toEqual(["navegar /acceso"]);
  });
});

describe("el usuario llega al menú", () => {
  it("el layout pasa el usuario al marco y el marco a los dos menús y al encabezado", () => {
    expect(leer("src/app/(app)/layout.tsx")).toMatch(/<Marco usuario=\{/);
    const marco = leer("src/componentes/estructura/Marco.tsx");
    expect(marco).toMatch(/<MenuLateral usuario=\{usuario\}/);
    expect(marco).toMatch(/<BarraInferior usuario=\{usuario\}/);
    expect(marco).toMatch(/<EncabezadoUsuario usuario=\{usuario\}/);
  });

  it("el menú lateral y el diálogo Más muestran el bloque del usuario", () => {
    expect(leer("src/componentes/estructura/MenuLateral.tsx")).toMatch(/<BloqueUsuario usuario=\{usuario\}/);
    expect(leer("src/componentes/estructura/BarraInferior.tsx")).toMatch(/<BloqueUsuario usuario=\{usuario\}/);
  });

  it("al navegador solo llegan nombre, rol y sucursal (sin ids)", () => {
    const layout = leer("src/app/(app)/layout.tsx");
    expect(layout).not.toMatch(/authId|\.id\b/);
  });
});
