import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { llenarCotizador } from "./ayudas";

// Prueba mínima de accesibilidad del menú y de los componentes.

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function sinViolaciones(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  const resumen = r.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(" | ")})`);
  expect(resumen, "violaciones de axe").toEqual([]);
}

test.describe("1. axe sin violaciones (WCAG 2.2 AA)", () => {
  for (const ancho of [390, 1280]) {
    test(`/cotizador vacío y con vista previa a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/cotizador");
      await sinViolaciones(page);
      await llenarCotizador(page);
      await sinViolaciones(page);
    });

    test(`/ (inicio) a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/");
      await sinViolaciones(page);
    });

    test(`/diseno a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/diseno");
      await sinViolaciones(page);
    });
  }
});

test.describe("2. teclado en el menú", () => {
  test("salto al contenido, orden de destinos, aria-current y Próximamente", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");

    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveText("Saltar al contenido");
    await page.keyboard.press("Enter");
    await expect(page.locator(":focus")).toHaveId("contenido");

    await page.goto("/cotizador");
    await page.keyboard.press("Tab"); // saltar al contenido
    await page.keyboard.press("Tab"); // logo
    await expect(page.locator(":focus")).toHaveAccessibleName("Crediflexi, ir al inicio");

    const menu = page.getByRole("navigation", { name: "Navegación principal" }).first();
    const esperados = ["Cotizador", "Pipeline", "Comisiones", "Plan semanal", "Proyección", "Metas", "Cartera", "Biblioteca"];
    for (const nombre of esperados) {
      await page.keyboard.press("Tab");
      const enfocado = page.locator(":focus");
      await expect(enfocado).toContainText(nombre);
      await expect(menu.locator(":focus")).toHaveCount(1);
    }

    const cotizador = menu.getByRole("link", { name: "Cotizador" });
    await expect(cotizador).toHaveAttribute("aria-current", "page");
    await expect(menu.getByRole("link", { name: "Pipeline" })).toHaveAttribute("href", "/pipeline");
    await expect(menu.getByRole("link", { name: "Comisiones" })).toHaveAttribute("href", "/comisiones");
    await expect(menu.getByRole("link", { name: "Biblioteca" })).toHaveAttribute("href", "/biblioteca");
    await expect(menu.getByRole("button", { name: /Biblioteca/ })).toHaveCount(0);

    for (const nombre of ["Plan semanal", "Proyección", "Metas", "Cartera"]) {
      const b = menu.getByRole("button", { name: new RegExp(nombre) });
      await expect(b).toHaveAttribute("aria-disabled", "true");
      await expect(b).toContainText("Próximamente");
      await expect(menu.getByRole("link", { name: new RegExp(nombre) })).toHaveCount(0);
    }

    // Enter sobre un destino "Próximamente" no navega.
    await menu.getByRole("button", { name: /Plan semanal/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/cotizador$/);
  });

  test("el botón de plegar cambia aria-expanded (abierto en 1280, plegado en 768)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    const plegar = page.getByRole("button", { name: "Plegar el menú" });
    await expect(plegar).toHaveAttribute("aria-expanded", "true");
    await plegar.focus();
    await page.keyboard.press("Enter");
    const desplegar = page.getByRole("button", { name: "Desplegar el menú" });
    await expect(desplegar).toHaveAttribute("aria-expanded", "false");

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/cotizador");
    await expect(page.getByRole("button", { name: "Desplegar el menú" })).toHaveAttribute("aria-expanded", "false");
  });

  test("barra inferior del celular: cuatro destinos, Más y Próximamente para el lector de pantalla", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/cotizador");
    const barra = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(barra).toHaveCount(1); // el menú lateral está oculto
    await expect(barra.getByRole("link", { name: "Cotizador" })).toHaveAttribute("aria-current", "page");
    await expect(barra.getByRole("link", { name: "Pipeline" })).toHaveAttribute("href", "/pipeline");
    await expect(barra.getByRole("button", { name: "Plan semanal, Próximamente" })).toHaveAttribute("aria-disabled", "true");

    const mas = barra.getByRole("button", { name: "Más" });
    await mas.focus();
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog", { name: "Más secciones" });
    await expect(dialogo).toBeVisible();
    for (const nombre of ["Metas", "Cartera"]) {
      await expect(dialogo.getByRole("button", { name: `${nombre}, Próximamente` })).toHaveAttribute("aria-disabled", "true");
      await expect(dialogo.getByRole("link", { name: new RegExp(nombre) })).toHaveCount(0);
    }
    await expect(dialogo.getByRole("link", { name: "Biblioteca" })).toHaveAttribute("href", "/biblioteca");
    await expect(dialogo.getByRole("button", { name: /Biblioteca/ })).toHaveCount(0);
    await sinViolaciones(page);
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(mas).toBeFocused();
  });
});

/** Controles enfocables visibles de la página (sin el enlace de salto, que es invisible hasta enfocarlo). */
const CONTROLES = 'a[href]:not([href="#contenido"]), button, select, input, textarea, [role="tab"]';

test.describe("3. foco visible", () => {
  test("cada control de /diseno muestra un contorno al enfocarlo con el teclado", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/diseno");
    await page.keyboard.press("Tab"); // modo teclado para :focus-visible
    const sinContorno = await page.evaluate((selector) => {
      const fallas: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (el.offsetParent === null || el.hasAttribute("disabled") || el.tabIndex < 0) continue;
        el.focus();
        // Los radios del control segmentado son invisibles: el contorno lo lleva su etiqueta.
        const visible = el.matches('input[type="radio"]') ? (el.closest("label") as HTMLElement) : el;
        const e = getComputedStyle(visible);
        if (e.outlineStyle === "none" || parseFloat(e.outlineWidth) <= 0) {
          fallas.push(el.outerHTML.slice(0, 80));
        }
      }
      return fallas;
    }, CONTROLES);
    expect(sinContorno).toEqual([]);
  });
});

test.describe("4. objetivos táctiles de 44 px o más", () => {
  for (const [ruta, ancho] of [
    ["/", 1280],
    ["/", 390],
    ["/diseno", 1280],
    ["/diseno", 390],
    ["/cotizador", 390],
    ["/cotizador", 768],
  ] as const) {
    test(`${ruta} a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto(ruta);
      const chicos = await page.evaluate((selector) => {
        const fallas: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
          if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
          // Casillas y radios se tocan por su etiqueta.
          const objetivo = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.closest("label") as HTMLElement) : el;
          const r = objetivo.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 44 || r.height < 44) fallas.push(`${Math.round(r.width)}×${Math.round(r.height)} ${objetivo.outerHTML.slice(0, 80)}`);
        }
        return fallas;
      }, CONTROLES);
      expect(chicos).toEqual([]);
    });
  }
});

test.describe("5 y 6. diálogo y pestañas", () => {
  test("el diálogo recibe el foco, se cierra con Esc y devuelve el foco", async ({ page }) => {
    await page.goto("/diseno");
    const abrir = page.getByRole("button", { name: "Abrir el diálogo" });
    await abrir.focus();
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("dialog", { name: "Descartar los cambios" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(abrir).toBeFocused();
  });

  test("las flechas cambian de pestaña", async ({ page }) => {
    await page.goto("/diseno");
    const lista = page.getByRole("tablist", { name: "Vistas de ejemplo" });
    await lista.getByRole("tab", { name: "Esta semana" }).focus();
    await page.keyboard.press("ArrowRight");
    const siguiente = lista.getByRole("tab", { name: "Siguiente semana" });
    await expect(siguiente).toBeFocused();
    await expect(siguiente).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(lista.getByRole("tab", { name: "Esta semana" })).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("7. movimiento y transparencia reducidos", () => {
  test("con movimiento reducido el número cambia sin transición", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/diseno");
    const duracion = await page.locator(".odometro-tira").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duracion).toBe("0s");
  });

  test("sin preferencia, el número sí tiene transición", async ({ page }) => {
    await page.goto("/diseno");
    const duracion = await page.locator(".odometro-tira").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duracion).not.toBe("0s");
  });

  test("con transparencia reducida el vidrio es opaco", async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    await page.goto("/diseno");
    const vidrio = page.locator(".vidrio").first();
    expect(await vidrio.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
    expect(await vidrio.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(14, 57, 109)");
  });
});

test.describe("8. sin saltos de diseño", () => {
  test("el cotizador no salta al cargar ni al calcular", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __saltos: number };
      w.__saltos = 0;
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) w.__saltos += e.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/cotizador");
    await llenarCotizador(page);
    await page.waitForTimeout(1000);
    const saltos = await page.evaluate(() => (window as unknown as { __saltos: number }).__saltos);
    expect(saltos).toBeLessThan(0.1);
  });
});

test("máximo 4 capas con desenfoque por pantalla", async ({ page }) => {
  for (const [ruta, ancho] of [
    ["/", 1280],
    ["/", 390],
    ["/cotizador", 1280],
    ["/cotizador", 390],
    ["/diseno", 1280],
    ["/diseno", 390],
  ] as const) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto(ruta);
    const capas = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((el) => {
          if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
          const f = getComputedStyle(el).backdropFilter;
          return f !== "none" && f !== "";
        }).length,
    );
    expect(capas, `${ruta} a ${ancho} px`).toBeLessThanOrEqual(4);
  }
});

test.describe("inicio", () => {
  test("nueve tarjetas en Próximamente, sin cifras, y los accesos a cotizador y nuevo prospecto funcionan", async ({ page }) => {
    await page.goto("/");
    const resumen = page.getByRole("region", { name: "Resumen" });
    const tarjetas = resumen.getByRole("region");
    await expect(tarjetas).toHaveCount(9);
    for (const t of await tarjetas.all()) await expect(t).toContainText("Próximamente");
    await expect(resumen).not.toContainText("$");
    await page.getByRole("link", { name: /Nueva cotización/ }).click();
    await expect(page).toHaveURL(/\/cotizador$/);
    await page.goto("/");
    await page.getByRole("link", { name: /Nuevo prospecto/ }).click();
    await expect(page).toHaveURL(/\/pipeline\?nuevo=1$/);
    await expect(page.getByRole("dialog", { name: "Nuevo prospecto" })).toBeVisible();
  });
});
