import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../../src/proxy";
import * as proxyModulo from "../../../src/proxy";
import {
  CLIENTES_EJEMPLO,
  DOCUMENTOS_EJEMPLO,
  PIPELINE_EJEMPLO,
  PROYECCION_EJEMPLO,
  SEMANA_EJEMPLO,
} from "../../../src/app/diseno/datosEjemplo";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("catálogo /diseno: solo local", () => {
  it("el proxy no tiene matcher, así que también cubre /diseno", () => {
    expect("config" in proxyModulo).toBe(false);
  });

  it("una petición a /diseno con Host no local recibe 403", () => {
    const r = proxy(new NextRequest("http://ejemplo.com/diseno", { headers: { host: "ejemplo.com" } }));
    expect(r.status).toBe(403);
  });

  it("una petición a /diseno con Host localhost pasa", () => {
    const r = proxy(new NextRequest("http://localhost:3000/diseno", { headers: { host: "localhost:3000" } }));
    expect(r.status).toBe(200);
  });

  it("no aparece en el menú", () => {
    expect(leer("src/componentes/estructura/navegacion.ts")).not.toMatch(/\/diseno/);
  });
});

describe("catálogo /diseno: datos sintéticos y marcados", () => {
  it("cada sección con datos lleva el rótulo «Datos de ejemplo»", () => {
    const pagina = leer("src/app/diseno/page.tsx");
    expect(pagina).toContain("Datos de ejemplo");
    for (const titulo of ["Pipeline", "Plan semanal", "Proyección", "Cifras y totales", "Inicio", "Cartera", "Biblioteca"]) {
      expect(pagina).toMatch(new RegExp(`titulo="${titulo}"[^>]*ejemplo\\s*>`));
    }
  });

  it("los nombres dicen «Ejemplo» y los teléfonos son 55 0000 00XX", () => {
    for (const f of PIPELINE_EJEMPLO) {
      expect(f.nombre).toMatch(/Ejemplo/);
      expect(f.ejecutivo).toMatch(/Ejemplo/);
      expect(f.contacto).toMatch(/^55 0000 00\d\d$/);
    }
    for (const f of PROYECCION_EJEMPLO) {
      expect(f.inversionista).toMatch(/Ejemplo/);
      expect(f.ejecutivo).toMatch(/Ejemplo/);
    }
    for (const d of SEMANA_EJEMPLO) {
      for (const b of Object.values(d.bloques)) {
        if (b?.que?.startsWith("Cita con")) expect(b.que).toMatch(/Ejemplo/);
      }
    }
  });

  it("clientes de ejemplo: nombre con «Ejemplo» y teléfono 55 0000 00XX; documentos marcados «(ejemplo)»", () => {
    for (const c of CLIENTES_EJEMPLO) {
      expect(c.nombre).toMatch(/Ejemplo/);
      expect(c.telefono).toMatch(/^55 0000 00\d\d$/);
    }
    for (const d of DOCUMENTOS_EJEMPLO) expect(d.nombre).toMatch(/\(ejemplo\)$/);
  });

  it("la biblioteca de ejemplo no trae documentos de clientes ni de identidad", () => {
    for (const d of DOCUMENTOS_EJEMPLO) {
      expect(d.nombre).not.toMatch(/INE|CURP|RFC|CLABE|estado de cuenta|identificaci/i);
    }
  });

  it("el plan de ejemplo va de lunes a viernes", () => {
    expect(SEMANA_EJEMPLO.map((d) => d.nombre)).toEqual(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]);
  });

  it("los componentes de vista no suman ni importan decimal.js ni el dominio", () => {
    for (const f of ["TablaPipeline", "CuadriculaSemanal", "TablaProyeccion", "TarjetaTotal", "TarjetaCliente", "TarjetaDocumento", "BibliotecaDocumentos"]) {
      const codigo = leer(`src/componentes/vistas/${f}.tsx`);
      expect(codigo).not.toMatch(/domain|aplicacion|servidor|decimal|seed|reduce\(/);
    }
  });
});
