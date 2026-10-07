import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  encabezadoResultado,
  ORGANIZACION_NOMBRADA,
  parsearArgumentos,
  planSintetico,
} from "../../../scripts/crear-usuarios-sinteticos.mjs";
import { exigirUrlLocal } from "../../../scripts/supabase-local.mjs";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("parsearArgumentos", () => {
  it("sin banderas crea el juego sintético completo", () => {
    expect(parsearArgumentos([])).toEqual({ modo: "sinteticos" });
  });

  it("con las cuatro banderas crea un usuario nombrado", () => {
    expect(
      parsearArgumentos(["--correo", "fer.rocha@crediflexi.test", "--nombre", "Fernando Rocha", "--rol", "EJECUTIVO", "--sucursal", "Metepec"]),
    ).toEqual({ modo: "nombrado", correo: "fer.rocha@crediflexi.test", nombre: "Fernando Rocha", rol: "EJECUTIVO", sucursal: "Metepec" });
  });

  it("acepta la forma --bandera=valor", () => {
    expect(parsearArgumentos(["--correo=a@ejemplo.test", "--nombre=Ana Sintética", "--rol=GERENTE", "--sucursal=Centro"])).toMatchObject({
      modo: "nombrado",
      rol: "GERENTE",
    });
  });

  it.each([
    [["--correo", "a@ejemplo.test"], /faltan/i],
    [["--correo", "no-es-correo", "--nombre", "A", "--rol", "EJECUTIVO", "--sucursal", "S"], /correo/i],
    [["--correo", "a@ejemplo.test", "--nombre", "  ", "--rol", "EJECUTIVO", "--sucursal", "S"], /nombre/i],
    [["--correo", "a@ejemplo.test", "--nombre", "A", "--rol", "ADMIN", "--sucursal", "S"], /DIRECTOR_REGIONAL, GERENTE o EJECUTIVO/],
    [["--correo", "a@ejemplo.test", "--nombre", "A", "--rol", "EJECUTIVO", "--sucursal", ""], /sucursal/i],
    [["--desconocida", "x"], /desconocida/i],
  ])("con %j explica el error en español", (argv, mensaje) => {
    expect(() => parsearArgumentos(argv)).toThrow(mensaje);
  });

  it("la organización del modo nombrado se llama Crediflexi", () => {
    expect(ORGANIZACION_NOMBRADA).toBe("Crediflexi");
  });
});

describe("encabezadoResultado", () => {
  it("dice datos sintéticos solo en el modo sintético", () => {
    expect(encabezadoResultado("sinteticos")).toBe("Usuarios creados en Supabase local (datos sintéticos).");
    expect(encabezadoResultado("nombrado")).toBe("Usuario creado en Supabase local.");
  });
});

describe("planSintetico", () => {
  const plan = planSintetico();

  it("una Organización Sintética con dos sucursales", () => {
    expect(plan.organizacion).toBe("Organización Sintética");
    expect(plan.sucursales).toHaveLength(2);
  });

  it("un director, un gerente y dos ejecutivos, todos @ejemplo.test, con cadena de mando", () => {
    expect(plan.usuarios.map((u: { rol: string }) => u.rol)).toEqual(["DIRECTOR_REGIONAL", "GERENTE", "EJECUTIVO", "EJECUTIVO"]);
    for (const u of plan.usuarios) {
      expect(u.correo).toMatch(/^[a-z0-9.]+@ejemplo\.test$/);
      expect(plan.sucursales).toContain(u.sucursal);
    }
    const [director, gerente, e1, e2] = plan.usuarios;
    expect(director.jefe).toBeNull();
    expect(gerente.jefe).toBe(director.clave);
    expect(e1.jefe).toBe(gerente.clave);
    expect(e2.jefe).toBe(gerente.clave);
  });

  it("8 prospectos Prospecto Sintético 01…08, de los ejecutivos, con contacto de 10 dígitos", () => {
    expect(plan.prospectos.map((p: { nombre: string }) => p.nombre)).toEqual(
      Array.from({ length: 8 }, (_, i) => `Prospecto Sintético ${String(i + 1).padStart(2, "0")}`),
    );
    const ejecutivos = plan.usuarios.filter((u: { rol: string }) => u.rol === "EJECUTIVO").map((u: { clave: string }) => u.clave);
    for (const p of plan.prospectos) {
      expect(ejecutivos).toContain(p.ejecutivo);
      expect(p.contacto).toMatch(/^[0-9]{10}$/);
      expect(["INTERESADO", "INTERMITENTE", "NO_INTERESADO"]).toContain(p.estatus);
    }
  });
});

describe("solo local y sin llaves a la vista", () => {
  it.each(["https://abcdefgh.supabase.co", "http://10.0.0.5:54321"])("se niega con %s", (url) => {
    expect(() => exigirUrlLocal(url)).toThrow(/local/);
  });

  it("la llave de servicio nunca se imprime ni se escribe en archivos", () => {
    for (const f of ["scripts/crear-usuarios-sinteticos.mjs", "scripts/supabase-local.mjs"]) {
      const codigo = leer(f);
      const salidas = codigo.split("\n").filter((l) => /console\.|process\.std(out|err)\.write/.test(l));
      for (const l of salidas) expect(l, f).not.toMatch(/llave|secret|key/i);
      expect(codigo, f).not.toMatch(/writeFile|appendFile|createWriteStream/);
    }
  });

  it("si ya existen, se niega y explica npm run db:reset", () => {
    expect(leer("scripts/crear-usuarios-sinteticos.mjs")).toMatch(/npm run db:reset/);
  });

  it("package.json tiene el script usuarios:sinteticos", () => {
    const { scripts } = JSON.parse(leer("package.json")) as { scripts: Record<string, string> };
    expect(scripts["usuarios:sinteticos"]).toBe("node scripts/crear-usuarios-sinteticos.mjs");
  });
});
