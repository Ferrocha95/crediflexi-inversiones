"use client";

import {
  CircleAlert,
  CircleCheck,
  Clock,
  Download,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  Lock,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { InsigniaTono, type Tono } from "../ui/InsigniaTono";

export type TipoArchivo = "pdf" | "xlsx" | "docx" | "pptx" | "imagen" | "otro";
export type Nivel = "Público" | "Interno";
export type Vigencia = "vigente" | "por vencer" | "vencido";

/** Un documento de la Biblioteca, ya formateado. Solo materiales internos: nunca documentos de clientes. */
export interface DatosDocumento {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: TipoArchivo;
  readonly categoria: string;
  readonly nivel: Nivel;
  readonly vigencia: Vigencia;
  /** Por ejemplo "v3". */
  readonly version: string;
}

const ICONO_TIPO: Record<TipoArchivo, { Icono: LucideIcon; etiqueta: string }> = {
  pdf: { Icono: FileText, etiqueta: "PDF" },
  xlsx: { Icono: FileSpreadsheet, etiqueta: "Excel" },
  docx: { Icono: FileText, etiqueta: "Word" },
  pptx: { Icono: Presentation, etiqueta: "PowerPoint" },
  imagen: { Icono: FileImage, etiqueta: "Imagen" },
  otro: { Icono: File, etiqueta: "Archivo" },
};

const VIGENCIA: Record<Vigencia, { tono: Tono; Icono: LucideIcon; etiqueta: string }> = {
  vigente: { tono: "positivo", Icono: CircleCheck, etiqueta: "Vigente" },
  "por vencer": { tono: "atencion", Icono: Clock, etiqueta: "Por vencer" },
  vencido: { tono: "alerta", Icono: CircleAlert, etiqueta: "Vencido" },
};

export function IconoTipo({ tipo }: { readonly tipo: TipoArchivo }) {
  const { Icono, etiqueta } = ICONO_TIPO[tipo];
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-hielo/10 text-hielo">
      <Icono aria-hidden="true" className="size-6" />
      <span className="sr-only">{etiqueta}</span>
    </span>
  );
}

export function InsigniaNivel({ nivel }: { readonly nivel: Nivel }) {
  return nivel === "Público" ? (
    <InsigniaTono etiqueta="Público" tono="neutro" Icono={Globe} />
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-marino px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap text-hielo ring-1 ring-hielo/25">
      <Lock aria-hidden="true" className="size-3.5" />
      Interno
    </span>
  );
}

export function InsigniaVigencia({ vigencia }: { readonly vigencia: Vigencia }) {
  const v = VIGENCIA[vigencia];
  return <InsigniaTono etiqueta={v.etiqueta} tono={v.tono} Icono={v.Icono} />;
}

export function Categoria({ texto }: { readonly texto: string }) {
  return <span className="rounded-md bg-hielo/10 px-2 py-0.5 text-sm font-semibold text-hielo">{texto}</span>;
}

export interface AccionesDocumento {
  readonly alVer?: (d: DatosDocumento) => void;
  readonly alDescargar?: (d: DatosDocumento) => void;
}

/** Botones Ver y Descargar; el nombre del documento va en su etiqueta para el lector de pantalla. */
export function BotonesDocumento({ documento, alVer, alDescargar }: { readonly documento: DatosDocumento } & AccionesDocumento) {
  const boton =
    "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3.5 font-bold transition-colors duration-150";
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-label={`Ver ${documento.nombre}`}
        onClick={() => alVer?.(documento)}
        className={`${boton} text-hielo hover:bg-hielo/10`}
      >
        <Eye aria-hidden="true" className="size-5" />
        <span aria-hidden="true">Ver</span>
      </button>
      <button
        type="button"
        aria-label={`Descargar ${documento.nombre}`}
        onClick={() => alDescargar?.(documento)}
        className={`${boton} bg-hielo text-marino hover:bg-blanco`}
      >
        <Download aria-hidden="true" className="size-5" />
        <span aria-hidden="true">Descargar</span>
      </button>
    </div>
  );
}

/** Tarjeta de documento para la vista de galería de la Biblioteca. */
export function TarjetaDocumento({ documento, alVer, alDescargar }: { readonly documento: DatosDocumento } & AccionesDocumento) {
  return (
    <article className="superficie elevable flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <IconoTipo tipo={documento.tipo} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="font-bold break-words">{documento.nombre}</h3>
          <p className="text-sm text-hielo-tenue">Versión {documento.version}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Categoria texto={documento.categoria} />
        <InsigniaNivel nivel={documento.nivel} />
        <InsigniaVigencia vigencia={documento.vigencia} />
      </div>
      <div className="mt-auto">
        <BotonesDocumento documento={documento} alVer={alVer} alDescargar={alDescargar} />
      </div>
    </article>
  );
}
