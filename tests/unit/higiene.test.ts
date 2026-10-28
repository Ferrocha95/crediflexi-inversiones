import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("higiene del proyecto", () => {
  it("dev y start pasan por scripts/con-entorno.mjs, que escucha solo en 127.0.0.1", () => {
    const { scripts } = JSON.parse(leer("package.json")) as { scripts: Record<string, string> };
    expect(scripts.dev).toBe("node scripts/con-entorno.mjs dev");
    expect(scripts.start).toBe("node scripts/con-entorno.mjs start");
    expect(leer("scripts/con-entorno.mjs")).toMatch(/"-H", "127\.0\.0\.1"/);
  });

  it(".gitignore excluye los PDF y la carpeta de Playwright MCP", () => {
    const lineas = leer(".gitignore").split(/\r?\n/);
    expect(lineas).toContain("*.pdf");
    expect(lineas).toContain(".playwright-mcp/");
  });

  it("README.md dice que ninguna forma de correr la app está lista para datos reales, y cómo correr la app y las pruebas", () => {
    const readme = leer("README.md");
    expect(readme).toMatch(/ninguna está lista para datos reales/i);
    expect(readme).toMatch(/no se debe\s+desplegar con datos reales/i);
    expect(readme).toMatch(/solo datos sintéticos/i);
    for (const comando of ["npm run dev", "npm run test:unit", "npm run test:rls", "npm run db:start"]) {
      expect(readme).toContain(comando);
    }
    expect(readme).toMatch(/Supabase local/);
  });

  describe("README.md, sección Despliegue de prueba", () => {
    const readme = leer("README.md");
    const inicio = readme.indexOf("\n## Despliegue de prueba\n");
    const fin = readme.indexOf("\n## ", inicio + 1);
    const seccion = inicio < 0 ? "" : readme.slice(inicio, fin < 0 ? undefined : fin);
    const subseccion = (titulo: string) => {
      const i = seccion.indexOf(`\n### ${titulo}\n`);
      const j = seccion.indexOf("\n### ", i + 1);
      return i < 0 ? "" : seccion.slice(i, j < 0 ? undefined : j);
    };

    it("existe", () => {
      expect(seccion).not.toBe("");
    });

    it("no inventa botones: pide verificar en el panel y en la página de precios", () => {
      expect(seccion.match(/verifícalo en el panel/gi)?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(seccion).toMatch(/verifícalo en la\s+página de precios/i);
    });

    it("trae los avisos de los planes y del límite de Vercel", () => {
      const avisos = subseccion("Avisos de los planes gratuitos");
      expect(avisos).toMatch(/Vercel Hobby\*\* es para uso personal y no comercial/);
      expect(avisos).toMatch(/pausa el proyecto\*\*\s+tras una semana sin uso/);
      expect(avisos).toMatch(/no incluye respaldos/);
      expect(avisos).toMatch(/4\.5 MB/);
    });

    it("migraciones con supabase link y db push, sin pegar contraseñas en ningún chat", () => {
      expect(seccion).toContain("npx supabase link --project-ref <referencia>");
      expect(seccion).toContain("npx supabase db push");
      expect(seccion).toMatch(/No pegues contraseñas, llaves ni\s+tokens en ningún chat/);
    });

    it("registro cerrado, contraseñas de 12 con mayúscula, minúscula y dígito, y correo activo", () => {
      const auth = subseccion("3. Cerrar el registro y exigir contraseñas fuertes");
      expect(auth).toMatch(/Cerrar el registro público/);
      expect(auth).toMatch(/12 caracteres como mínimo, con mayúscula, minúscula y\s+dígito/);
      expect(auth).toMatch(/inicio de sesión por correo y contraseña sigue activo/);
    });

    it("usuarios: cuenta en el panel y su SQL con scripts/sql-alta-usuario.mjs", () => {
      const usuarios = subseccion("4. Crear los usuarios");
      expect(usuarios).toContain("node scripts/sql-alta-usuario.mjs --auth-id");
      expect(usuarios).toContain("--crear-sucursal --organizacion");
      expect(usuarios).toContain("--jefe-id");
    });

    it("las cuatro variables, ninguna con NEXT_PUBLIC_, y solo la llave publicable", () => {
      const vercel = subseccion("5. Importar el repositorio en Vercel");
      for (const v of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "HOSTS_PERMITIDOS", "ENTORNO"]) {
        expect(vercel).toMatch(new RegExp(`\\| \`${v}\` \\|`));
      }
      expect(vercel).toMatch(/ninguna lleva el prefijo\s+`NEXT_PUBLIC_`/);
      expect(seccion).not.toMatch(/`NEXT_PUBLIC_[A-Z]/);
      expect(vercel).toMatch(/nunca la secreta ni la de servicio/);
    });

    it("primer despliegue: 403 esperado, poner la dirección en HOSTS_PERMITIDOS y redesplegar", () => {
      const primero = subseccion("6. Primer despliegue, dirección y redespliegue");
      expect(primero).toMatch(/\*\*403\*\*/);
      expect(primero).toMatch(/Es lo\s+esperado/);
      expect(primero).toMatch(/Ponla en `HOSTS_PERMITIDOS`/);
      expect(primero).toMatch(/Vuelve a desplegar/);
    });

    it("lista de humo completa", () => {
      const humo = subseccion("Lista de humo del primer despliegue");
      for (const re of [
        /Iniciar sesión/,
        /PDF en pesos/,
        /PDF en dólares \(USD\)/,
        /plazo especial/,
        /Pipeline: .*4 MB/,
        /Comisiones con PDF/,
        /Reclutamiento con PDF/,
        /Biblioteca con subcarpetas: .*subir.*verlo y descargarlo/,
        /el trazado de `next build`\s+en local no lo garantiza/,
      ]) {
        expect(humo).toMatch(re);
      }
    });

    it("lista previa a datos reales completa", () => {
      const previa = subseccion("Antes de capturar datos reales");
      for (const re of [
        /Autorización \*\*por escrito\*\* del dueño/,
        /\*\*de la empresa\*\*/,
        /Respaldos de la base \*\*y\*\* del almacenamiento.*\*\*prueba de restauración\*\*/,
        /\*\*Segundo factor\*\*.*\*\*aceptado por escrito\*\*/,
        /\*\*Aviso de privacidad\*\*/,
        /\*\*Borrar los usuarios sintéticos\*\*/,
        /Revisar las políticas/,
        /`ENTORNO=produccion`/,
      ]) {
        expect(previa).toMatch(re);
      }
    });

    it("no trae nada con forma de llave, token o contraseña", () => {
      for (const re of [/eyJ[A-Za-z0-9_-]{10,}/, /sb_(publishable|secret)_[A-Za-z0-9_-]{8,}/, /https:\/\/[a-z0-9]{20}\.supabase\.co/, /postgres(ql)?:\/\/[^\s`]*:[^\s`]*@/]) {
        expect(readme).not.toMatch(re);
      }
    });
  });

  it("PENDIENTES_TECNICOS.md trae los pendientes ii, jj y kk", () => {
    const pendientes = leer("PENDIENTES_TECNICOS.md");
    expect(pendientes).toMatch(/^- \(ii\) .*Playwright/m);
    expect(pendientes).toMatch(/^- \(jj\) .*estatus del tramo/m);
    expect(pendientes).toMatch(/^- \(kk\) .*aviso fabricado a mano/m);
  });
});
