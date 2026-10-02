/** Los tres estatus del pipeline, con el texto exacto del Excel (docs/FORMATOS_EXCEL.md). */
export const ESTATUS_PIPELINE = ["INTERESADO", "INTERMITENTE", "NO INTERESADO"] as const;
export type EstatusPipeline = (typeof ESTATUS_PIPELINE)[number];

/** Fondo de cada estatus, el mismo color de la fila del Excel. El texto va en marino. */
export const FONDO_ESTATUS: Record<EstatusPipeline, string> = {
  INTERESADO: "bg-estatus-interesado",
  INTERMITENTE: "bg-estatus-intermitente",
  "NO INTERESADO": "bg-estatus-no-interesado",
};

/** Insignia de estatus del pipeline. Solo presenta: no decide nada. */
export function InsigniaEstatus({ estatus }: { readonly estatus: EstatusPipeline }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap text-marino ring-1 ring-marino/15 ${FONDO_ESTATUS[estatus]}`}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-marino/70" />
      {estatus}
    </span>
  );
}
