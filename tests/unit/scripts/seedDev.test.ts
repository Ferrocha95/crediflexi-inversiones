import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  generarSql,
  parsearArgumentos,
  RUTA_SEED,
  USUARIOS_DEV,
  validarContrasena,
} from "../../../scripts/generar-seed-dev.mjs";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");
const CONTRASENA = "Sintetica123Prueba";

describe("USUARIOS_DEV", () => {
  it("son los cuatro correos de prueba con su rol", () => {
    expect(USUARIOS_DEV.map((u) => [u.correo, u.rol])).toEqual([
      ["director@prueba.local", "DIRECTOR_REGIONAL"],
      ["gerente@prueba.local", "GERENTE"],
      ["ejecutivo1@prueba.local", "EJECUTIVO"],
      ["ejecutivo2@prueba.local", "EJECUTIVO"],
    ]);
  });

  it("forman la cadena de mando director -> gerente -> ejecutivos, y cada jefe va antes que su subordinado", () => {
    const porClave = new Map(USUARIOS_DEV.map((u, i) => [u.clave, { ...u, i }]));
    expect(porClave.get("director")?.jefe).toBeNull();
    expect(porClave.get("gerente")?.jefe).toBe("director");
    expect(porClave.get("ejecutivo1")?.jefe).toBe("gerente");
    expect(porClave.get("ejecutivo2")?.jefe).toBe("gerente");
    for (const u of porClave.values()) {
      if (u.jefe) expect(porClave.get(u.jefe)!.i).toBeLessThan(u.i);
    }
  });
});

describe("generarSql", () => {
  const sql = generarSql(CONTRASENA);

  it("crea organización, sucursal, cuentas, identidades y usuarios", () => {
    for (const tabla of ["public.organizaciones", "public.sucursales", "auth.users", "auth.identities", "public.usuarios"]) {
      expect(sql).toContain(`insert into ${tabla}`);
    }
    for (const u of USUARIOS_DEV) expect(sql).toContain(`'${u.correo}'`);
  });

  it("la contraseña solo aparece dentro de crypt(), una vez", () => {
    expect(sql.split(CONTRASENA)).toHaveLength(2);
    expect(sql).toContain(`extensions.crypt('${CONTRASENA}', extensions.gen_salt('bf'))`);
  });

  it("escapa comillas simples en la contraseña", () => {
    expect(generarSql("Abc'def12345")).toContain("'Abc''def12345'");
  });

  it("corre en una sola transacción", () => {
    expect(sql.trimStart().startsWith("--")).toBe(true);
    expect(sql).toMatch(/^begin;$/m);
    expect(sql).toMatch(/^commit;$/m);
  });
});

describe("validarContrasena", () => {
  it("rechaza las de menos de 12 caracteres (minimum_password_length)", () => {
    expect(() => validarContrasena("Corta1A")).toThrow(/12 caracteres/);
  });

  it.each([
    ["sinmayusculas123", /mayúscula/],
    ["SINMINUSCULAS4821", /minúscula/],
    ["SinDigitosNiNada", /dígito/],
  ])("acepta %s pero avisa qué le falta de password_requirements", (c, aviso) => {
    const avisos = validarContrasena(c);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(aviso);
  });

  it("sin avisos si cumple todas las reglas de config.toml", () => {
    expect(validarContrasena(CONTRASENA)).toEqual([]);
  });
});

describe("parsearArgumentos", () => {
  it("sin banderas genera la contraseña", () => {
    expect(parsearArgumentos([])).toEqual({ contrasena: null });
  });

  it("acepta --contrasena valor y --contrasena=valor", () => {
    expect(parsearArgumentos(["--contrasena", CONTRASENA])).toEqual({ contrasena: CONTRASENA });
    expect(parsearArgumentos([`--contrasena=${CONTRASENA}`])).toEqual({ contrasena: CONTRASENA });
  });

  it("rechaza banderas desconocidas", () => {
    expect(() => parsearArgumentos(["--otra"])).toThrow(/desconocida/i);
  });
});

describe("el archivo generado no se sube a git", () => {
  it("vive en supabase/seeds/local/, que .gitignore ignora explícitamente", () => {
    expect(RUTA_SEED).toBe("supabase/seeds/local/usuarios_dev.sql");
    expect(leer(".gitignore")).toMatch(/^supabase\/seeds\/local\/$/m);
  });

  it("config.toml lo carga con un glob, para que db reset no falle si no existe", () => {
    expect(leer("supabase/config.toml")).toMatch(/^sql_paths = \["\.\/seed\.sql", "\.\/seeds\/local\/\*\.sql"\]$/m);
  });
});
