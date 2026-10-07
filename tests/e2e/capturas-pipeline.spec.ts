import path from "node:path";
import { test, type Page } from "@playwright/test";
import { correoUnico, crearProspectoE2E, crearUsuarioE2E, entrar } from "./usuarios";

// Capturas del pipeline con datos sintéticos, para revisar el diseño. Se
// guardan FUERA del repositorio, en CAPTURAS_DIR (por omisión C:\dev\informes).
// Solo corren con `npm run capturas` (etiqueta @capturas).

const DIR = process.env.CAPTURAS_DIR ?? path.join("C:", "dev", "informes");
const archivo = (nombre: string) => path.join(DIR, `${nombre}.png`);

test.use({ storageState: { cookies: [], origins: [] } });

function diaEnMexico(dias: number): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const f = new Date(`${hoy}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

const PROSPECTOS = [
  { nombre: "Prospecto Sintético Alfa", contacto: "5500000801", estatus: "INTERESADO", seguimiento: diaEnMexico(-2), comentarios: "Pidió la cotización a 12 meses; llamar para confirmar." },
  { nombre: "Prospecto Sintético Beta", contacto: "5500000802", estatus: "INTERESADO", seguimiento: diaEnMexico(1), comentarios: "Cita en sucursal." },
  { nombre: "Prospecto Sintético Gamma", contacto: "5500000803", estatus: "INTERMITENTE", seguimiento: diaEnMexico(4), comentarios: "Responde a veces; enviar información por correo." },
  { nombre: "Prospecto Sintético Delta", contacto: "5500000804", estatus: "NO_INTERESADO", seguimiento: null, comentarios: "Ya invirtió en otro lado." },
  { nombre: "Prospecto Sintético Épsilon", contacto: "5500000805", estatus: "INTERESADO", seguimiento: diaEnMexico(8), comentarios: "" },
] as const;

async function preparar(page: Page, ancho: number) {
  const u = await crearUsuarioE2E({ correo: correoUnico("capturas"), nombre: "Ejecutiva Sintética Capturas", rol: "EJECUTIVO" });
  for (const p of PROSPECTOS) await crearProspectoE2E({ ejecutivoId: u.usuarioId, ...p });
  await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await entrar(page, u.correo, u.contrasena);
}

test.describe("capturas del pipeline @capturas", () => {
  for (const ancho of [390, 1280]) {
    test(`pipeline a ${ancho} px`, async ({ page }) => {
      await preparar(page, ancho);
      await page.goto("/pipeline");
      await page.screenshot({ path: archivo(`paso55-pipeline-${ancho}`), fullPage: true });
      await page.goto("/pipeline?estatus=INTERESADO");
      await page.screenshot({ path: archivo(`paso55-pipeline-filtro-${ancho}`), fullPage: true });
      await page.goto("/pipeline?nuevo=1");
      await page.getByRole("dialog", { name: "Nuevo prospecto" }).waitFor();
      await page.waitForTimeout(300);
      await page.screenshot({ path: archivo(`paso55-pipeline-dialogo-${ancho}`) });
    });
  }
});
