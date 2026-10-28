import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generarSql, literal, parsearArgumentos } from "../../../scripts/sql-alta-usuario.mjs";

const RUTA_SCRIPT = path.join(process.cwd(), "scripts", "sql-alta-usuario.mjs");
const AUTH_ID = "0b6f7c1e-3a2d-4f5b-9c8e-1d2a3b4c5d6e";
const JEFE_ID = "7e8f9a0b-1c2d-4e3f-8a9b-0c1d2e3f4a5b";

const base = (extra: string[] = []) => [
  "--auth-id",
  AUTH_ID,
  "--nombre",
  "Ana Sintética",
  "--rol",
  "EJECUTIVO",
  "--sucursal",
  "Centro",
  ...extra,
];

/**
 * Separa el SQL en su esqueleto (cada literal '…' cambiada por '?') y la lista
 * de literales ya decodificadas ('' -> '). Así se comprueba que un valor hostil
 * solo vive dentro de una literal: el esqueleto debe ser idéntico al de un
 * nombre inocente.
 */
function separarLiterales(sql: string) {
  let esqueleto = "";
  const literales: string[] = [];
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] !== "'") {
      esqueleto += sql[i];
      continue;
    }
    let valor = "";
    for (i++; ; i++) {
      if (i >= sql.length) throw new Error("Literal sin cerrar");
      if (sql[i] === "'") {
        if (sql[i + 1] === "'") {
          valor += "'";
          i++;
        } else break;
      } else valor += sql[i];
    }
    literales.push(valor);
    esqueleto += "'?'";
  }
  return { esqueleto, literales };
}

const sqlDe = (argv: string[]) => generarSql(parsearArgumentos(argv));

describe("parsearArgumentos", () => {
  it("lee las cuatro banderas obligatorias y deja el jefe en nulo", () => {
    expect(parsearArgumentos(base())).toEqual({
      authId: AUTH_ID,
      nombre: "Ana Sintética",
      rol: "EJECUTIVO",
      sucursal: "Centro",
      jefeId: null,
      crearSucursal: false,
      organizacion: null,
    });
  });

  it("acepta --bandera=valor, el jefe opcional, y normaliza uuid y rol", () => {
    const o = parsearArgumentos([
      `--auth-id=${AUTH_ID.toUpperCase()}`,
      "--nombre= Ana Sintética ",
      "--rol=gerente",
      "--sucursal=Centro",
      `--jefe-id=${JEFE_ID}`,
    ]);
    expect(o).toMatchObject({ authId: AUTH_ID, nombre: "Ana Sintética", rol: "GERENTE", jefeId: JEFE_ID });
  });

  it("--crear-sucursal exige --organizacion", () => {
    expect(() => parsearArgumentos(base(["--crear-sucursal"]))).toThrow(/--organizacion/);
    expect(parsearArgumentos(base(["--crear-sucursal", "--organizacion", "Organización Sintética"]))).toMatchObject({
      crearSucursal: true,
      organizacion: "Organización Sintética",
    });
  });

  it("--crear-sucursal no lleva valor", () => {
    expect(() => parsearArgumentos(base(["--crear-sucursal=si", "--organizacion", "X"]))).toThrow(/no lleva valor/);
  });

  it("rechaza banderas faltantes, desconocidas o repetidas", () => {
    expect(() => parsearArgumentos([])).toThrow(/--auth-id, --nombre, --rol, --sucursal/);
    expect(() => parsearArgumentos(base(["--correo", "a@ejemplo.test"]))).toThrow(/desconocida/);
    expect(() => parsearArgumentos(base(["--nombre", "Otra"]))).toThrow(/repetida/);
    expect(() => parsearArgumentos(["Ana"])).toThrow(/desconocida/);
  });

  it("rechaza un uuid mal formado en --auth-id y en --jefe-id", () => {
    const sinAuth = base().slice(2);
    for (const malo of ["", "123", `${AUTH_ID}0`, `${AUTH_ID.slice(0, 35)}g`, `'${AUTH_ID}'`, `${AUTH_ID}; drop table usuarios`]) {
      expect(() => parsearArgumentos(["--auth-id", malo, ...sinAuth])).toThrow(/--auth-id/);
      expect(() => parsearArgumentos(base(["--jefe-id", malo]))).toThrow(/--jefe-id/);
    }
  });

  it("solo acepta los tres roles", () => {
    for (const rol of ["DIRECTOR_REGIONAL", "GERENTE", "EJECUTIVO"]) {
      expect(parsearArgumentos([...base().slice(0, 4), "--rol", rol, "--sucursal", "Centro"]).rol).toBe(rol);
    }
    for (const rol of ["", "ADMIN", "EJECUTIVO'", "EJECUTIVO; --"]) {
      expect(() => parsearArgumentos([...base().slice(0, 4), "--rol", rol, "--sucursal", "Centro"])).toThrow(/rol/);
    }
  });

  it("los textos van de 1 a 150 caracteres (contando letras, no bytes)", () => {
    const largo = "ñ".repeat(150);
    expect(parsearArgumentos([...base().slice(0, 2), "--nombre", largo, ...base().slice(4)]).nombre).toBe(largo);
    for (const bandera of ["--nombre", "--sucursal", "--organizacion"]) {
      const extra = bandera === "--organizacion" ? [] : ["--organizacion", "Org"];
      for (const malo of ["", "   ", "ñ".repeat(151)]) {
        const argv = [...base(extra).filter((_, i, a) => a[i - 1] !== bandera && a[i] !== bandera), bandera, malo];
        expect(() => parsearArgumentos(argv)).toThrow(/1 a 150/);
      }
    }
  });

  it("rechaza caracteres de control e invisibles (saltos de línea, tabulador, nulo, etc.)", () => {
    // Construidos con números de punto de código, nunca escritos en el archivo.
    const puntos = [0x0, 0x9, 0xa, 0xd, 0x1b, 0x7f, 0x85, 0x200b, 0x202e, 0x2028, 0x2029, 0xfeff];
    for (const p of puntos) {
      const malo = `Ana${String.fromCodePoint(p)}Sintética`;
      expect(() => parsearArgumentos([...base().slice(0, 2), "--nombre", malo, ...base().slice(4)])).toThrow(/control o invisibles/);
      expect(() => parsearArgumentos([...base().slice(0, 6), "--sucursal", malo])).toThrow(/control o invisibles/);
      expect(() => parsearArgumentos(base(["--organizacion", malo]))).toThrow(/control o invisibles/);
    }
  });

  it("rechaza la barra invertida en los textos", () => {
    for (const malo of ["Ana\\", "Ana\\'; drop table usuarios; --", "\\x27"]) {
      expect(() => parsearArgumentos([...base().slice(0, 2), "--nombre", malo, ...base().slice(4)])).toThrow(/barra invertida/);
      expect(() => parsearArgumentos([...base().slice(0, 6), "--sucursal", malo])).toThrow(/barra invertida/);
    }
  });
});

describe("literal", () => {
  it("encierra en comillas simples y duplica la comilla simple", () => {
    expect(literal("Centro")).toBe("'Centro'");
    expect(literal("O'Brien")).toBe("'O''Brien'");
    expect(literal("''")).toBe("''''''");
  });
});

describe("generarSql", () => {
  const HOSTILES = [
    "O'Brien",
    "'; drop table public.usuarios; --",
    "x'); delete from public.usuarios; --",
    "Ana -- comentario",
    "Ana /* comentario */ Sintética",
    "*/ select 1; /*",
    "Ana; Sintética",
    "''''",
    "'",
    "$$ select 1 $$",
    "Ana' || (select current_user) || '",
  ];

  it("un valor hostil solo vive dentro de una literal, en nombre, sucursal y organización", () => {
    const inocente = separarLiterales(sqlDe(base(["--crear-sucursal", "--organizacion", "Org"])));
    for (const h of HOSTILES) {
      const argv = [
        "--auth-id",
        AUTH_ID,
        "--nombre",
        h,
        "--rol",
        "EJECUTIVO",
        "--sucursal",
        `S ${h}`,
        "--crear-sucursal",
        "--organizacion",
        `O ${h}`,
      ];
      const { esqueleto, literales } = separarLiterales(sqlDe(argv));
      expect(esqueleto).toBe(inocente.esqueleto);
      expect(literales).toContain(h);
      expect(literales).toContain(`S ${h}`);
      expect(literales).toContain(`O ${h}`);
      // Ninguna literal trae otra cosa que los valores dados, el uuid o el rol.
      for (const l of literales) expect([h, `S ${h}`, `O ${h}`, AUTH_ID, "EJECUTIVO"]).toContain(l);
    }
  });

  it("no usa literales con escapes (E'…', U&'…') ni dólares", () => {
    const sql = sqlDe(base([`--jefe-id`, JEFE_ID, "--crear-sucursal", "--organizacion", "Org"]));
    const { esqueleto } = separarLiterales(sql);
    expect(esqueleto).toContain(" '?'");
    expect(esqueleto).not.toMatch(/(?:[Ee]|[Uu]&)'\?'/);
    expect(sql).not.toContain("$");
  });

  it("sin --crear-sucursal solo inserta el usuario, dentro de una transacción", () => {
    const sql = sqlDe(base());
    expect(sql).toMatch(/^begin;$/m);
    expect(sql).toMatch(/^commit;$/m);
    expect(sql.match(/insert into/g)).toHaveLength(1);
    expect(sql).toContain("insert into public.usuarios (auth_id, nombre, rol, sucursal_id, jefe_id)");
    expect(sql).toContain(`'${AUTH_ID}'::uuid`);
    expect(sql).toContain("'EJECUTIVO'::public.rol_usuario");
    expect(sql).toMatch(/null\nreturning id, nombre, rol;/);
  });

  it("busca la sucursal con una subconsulta escalar por nombre (si se repite, falla y no inserta)", () => {
    const sql = sqlDe(base());
    expect(sql).toContain("(select s.id from public.sucursales s where lower(btrim(s.nombre)) = lower(btrim('Centro')))");
    expect(sql).not.toContain("public.organizaciones");
  });

  it("con --organizacion la subconsulta también filtra por organización", () => {
    const sql = sqlDe(base(["--organizacion", "Org"]));
    expect(sql.match(/insert into/g)).toHaveLength(1);
    expect(sql).toContain(
      "(select s.id from public.sucursales s join public.organizaciones o on o.id = s.organizacion_id where lower(btrim(s.nombre)) = lower(btrim('Centro')) and lower(btrim(o.nombre)) = lower(btrim('Org')))",
    );
  });

  it("con --jefe-id lo pone como uuid", () => {
    expect(sqlDe(base(["--jefe-id", JEFE_ID]))).toMatch(new RegExp(`'${JEFE_ID}'::uuid\\nreturning`));
  });

  it("con --crear-sucursal crea la organización y la sucursal solo si no existen", () => {
    const sql = sqlDe(base(["--crear-sucursal", "--organizacion", "Org"]));
    expect(sql.match(/insert into/g)).toHaveLength(3);
    const org = sql.indexOf("insert into public.organizaciones");
    const suc = sql.indexOf("insert into public.sucursales");
    const usu = sql.indexOf("insert into public.usuarios");
    expect(org).toBeGreaterThan(sql.indexOf("begin;"));
    expect(org).toBeLessThan(suc);
    expect(suc).toBeLessThan(usu);
    expect(sql).toContain("where not exists (select 1 from public.organizaciones where lower(btrim(nombre)) = lower(btrim('Org')))");
    expect(sql).toContain(
      "and not exists (select 1 from public.sucursales s where s.organizacion_id = o.id and lower(btrim(s.nombre)) = lower(btrim('Centro')))",
    );
  });

  it("los comentarios del SQL son fijos: no llevan ningún valor de los argumentos", () => {
    const argv = ["--auth-id", AUTH_ID, "--nombre", "Qwx", "--rol", "EJECUTIVO", "--sucursal", "Kpz", "--crear-sucursal", "--organizacion", "Zjv"];
    const comentarios = sqlDe(argv)
      .split("\n")
      .filter((l) => l.startsWith("--"));
    expect(comentarios.length).toBeGreaterThan(0);
    for (const c of comentarios) {
      for (const v of ["Qwx", "Kpz", "Zjv", AUTH_ID]) expect(c).not.toContain(v);
    }
  });
});

describe("scripts/sql-alta-usuario.mjs como programa", () => {
  // Entorno mínimo: el script no necesita ninguna variable (NODE_ENV solo por el tipo).
  const ENTORNO_MINIMO: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? "", NODE_ENV: "test" };
  const correr = (argv: string[]) => spawnSync(process.execPath, [RUTA_SCRIPT, ...argv], { encoding: "utf8", env: ENTORNO_MINIMO });

  it("imprime el SQL en la salida estándar y sale con 0", () => {
    const r = correr(base());
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe(sqlDe(base()));
  });

  it("con argumentos malos no imprime SQL, explica en español y sale con 1", () => {
    const r = correr(["--auth-id", "no-es-uuid", "--nombre", "Ana", "--rol", "EJECUTIVO", "--sucursal", "Centro"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/--auth-id/);
    expect(r.stderr).toMatch(/No se generó SQL/);
  });

  it("no se conecta a nada, no lee el entorno ni archivos ni llaves", () => {
    const fuente = readFileSync(RUTA_SCRIPT, "utf8");
    const imports = [...fuente.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.every((m) => m === "node:url")).toBe(true);
    for (const prohibido of [
      "process.env",
      "node:fs",
      "node:net",
      "node:http",
      "node:https",
      "node:child_process",
      "fetch(",
      "supabase-js",
      "createClient",
      "require(",
      "import(",
      "SERVICE_ROLE",
      "SECRET",
    ]) {
      expect(fuente).not.toContain(prohibido);
    }
  });
});
