import { describe, expect, it } from "vitest";
import {
  agruparPorCategoria,
  coincideBusqueda,
  elementoParaPantalla,
  normalizarBusqueda,
  tamanoEnTexto,
  type FilaBiblioteca,
} from "../../../src/aplicacion/biblioteca/vista";

// Lo que la pantalla de la Biblioteca hace con las filas que RLS devolvió:
// búsqueda por nombre sin distinguir mayúsculas ni acentos, tamaño y fecha
// legibles, el dominio de los enlaces y el agrupado por las 4 categorías.

const ORG = "11111111-2222-4333-8444-555555555555";
const fila = (cambios: Partial<FilaBiblioteca> = {}): FilaBiblioteca => ({
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  categoria: "CAPACITACION",
  nombre: "Manual de ventas",
  descripcion: "Guía para el equipo.",
  tipo: "ARCHIVO",
  enlace: null,
  ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.pdf`,
  tipo_mime: "application/pdf",
  tamano_bytes: 2_516_582,
  subido_por_nombre: "Gerente Sintético",
  creado_en: "2026-10-14T18:30:00Z",
  archivado_en: null,
  carpeta_id: null,
  ...cambios,
});

describe("normalizarBusqueda y coincideBusqueda", () => {
  it("quita mayúsculas, acentos y espacios de más", () => {
    expect(normalizarBusqueda("  Guía   RÁPIDA de Capacitación ")).toBe("guia rapida de capacitacion");
    expect(normalizarBusqueda("Niño Ñandú")).toBe("nino nandu");
  });

  it("busca sin distinguir mayúsculas ni acentos, en cualquier parte del nombre", () => {
    expect(coincideBusqueda("Guía rápida de Capacitación", "capacitacion")).toBe(true);
    expect(coincideBusqueda("Guía rápida de Capacitación", "GUIA RAP")).toBe(true);
    expect(coincideBusqueda("Guía rápida de Capacitación", "rápida")).toBe(true);
    expect(coincideBusqueda("Manual de ventas", "compras")).toBe(false);
  });

  it("una búsqueda vacía coincide con todo", () => {
    expect(coincideBusqueda("Manual de ventas", "")).toBe(true);
    expect(coincideBusqueda("Manual de ventas", "   ")).toBe(true);
  });

  it("la é compuesta y la descompuesta son la misma letra", () => {
    expect(coincideBusqueda("Café", "cafe\u0301")).toBe(true);
  });
});

describe("tamanoEnTexto", () => {
  it.each([
    [512, "512 bytes"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [2_516_582, "2.4 MB"],
    [4_194_304, "4 MB"],
    [26_214_400, "25 MB"],
  ])("%d bytes son %s", (bytes, texto) => {
    expect(tamanoEnTexto(bytes)).toBe(texto);
  });
});

describe("elementoParaPantalla", () => {
  it("un archivo PDF: tipo, tamaño, fecha en México, quién lo subió y que se puede ver", () => {
    expect(elementoParaPantalla(fila())).toEqual({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      categoria: "CAPACITACION",
      nombre: "Manual de ventas",
      descripcion: "Guía para el equipo.",
      esEnlace: false,
      tipo: "PDF",
      tamano: "2.4 MB",
      fecha: "14 oct 2026",
      subidoPor: "Gerente Sintético",
      archivado: false,
      previsualiza: true,
      enlace: null,
      dominio: null,
      carpetaId: null,
    });
  });

  it("la fecha es la de la Ciudad de México (de noche en UTC todavía es el día anterior)", () => {
    expect(elementoParaPantalla(fila({ creado_en: "2026-10-15T03:00:00Z" })).fecha).toBe("14 oct 2026");
  });

  it.each([
    ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX", false],
    ["png", "image/png", "PNG", true],
    ["mp4", "video/mp4", "MP4", true],
    ["csv", "text/csv", "CSV", false],
  ])("un .%s se muestra como %s", (ext, mime, tipo, previsualiza) => {
    const e = elementoParaPantalla(fila({ ruta: `${ORG}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.${ext}`, tipo_mime: mime }));
    expect(e.tipo).toBe(tipo);
    expect(e.previsualiza).toBe(previsualiza);
  });

  it("un enlace: sin tamaño, con el dominio visible", () => {
    const e = elementoParaPantalla(
      fila({ tipo: "ENLACE", enlace: "https://videos.ejemplo.test/bienvenida", ruta: null, tipo_mime: null, tamano_bytes: null }),
    );
    expect(e).toMatchObject({ esEnlace: true, tipo: "Enlace", tamano: null, enlace: "https://videos.ejemplo.test/bienvenida", dominio: "videos.ejemplo.test", previsualiza: false });
  });

  it("un archivado lo dice", () => {
    expect(elementoParaPantalla(fila({ archivado_en: "2026-10-14T19:00:00Z" })).archivado).toBe(true);
  });
});

describe("agruparPorCategoria", () => {
  it("siempre devuelve las 4 categorías en orden, aunque estén vacías, y ordena por nombre sin acentos", () => {
    const elementos = [
      elementoParaPantalla(fila({ id: "1", nombre: "Zeta", categoria: "HERRAMIENTAS" })),
      elementoParaPantalla(fila({ id: "2", nombre: "Ábaco", categoria: "HERRAMIENTAS" })),
      elementoParaPantalla(fila({ id: "3", nombre: "Organigrama", categoria: "EMPRESA" })),
    ];
    const grupos = agruparPorCategoria(elementos);
    expect(grupos.map((g) => g.categoria)).toEqual(["HERRAMIENTAS", "MULTIMEDIA", "EMPRESA", "CAPACITACION"]);
    expect(grupos[0].elementos.map((e) => e.nombre)).toEqual(["Ábaco", "Zeta"]);
    expect(grupos[1].elementos).toEqual([]);
    expect(grupos[2].elementos.map((e) => e.id)).toEqual(["3"]);
  });
});
