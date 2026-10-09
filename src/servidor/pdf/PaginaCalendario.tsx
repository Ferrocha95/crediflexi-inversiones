import "server-only";
import { Circle, Line, Path, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { Fragment } from "react";
import { LIENZO_BENCHMARK, type BarraBenchmark, type BenchmarkPdf, type GrupoBenchmark } from "../../aplicacion/benchmark";
import {
  LIENZO_FRANJA,
  LIENZO_GRAFICA,
  type ColorSerie,
  type FranjaPdf,
  type GraficaPdf,
  type ModeloPagina2,
  type TarjetaPdf,
  type TrazoSerie,
} from "../../aplicacion/pagina2";
import { COLOR_PDF as COLOR } from "./colores";
import { Logo, type LogoPdf } from "./Encabezado";
import { FAMILIA } from "./fuente";

// Página 2 del PDF: la modalidad 1 con su tabla mes a mes a la izquierda; a la
// derecha, la modalidad 2 anualizada, la comparación de modalidades y el
// comparativo de tasas (barras horizontales). Cada
// tarjeta dice cuándo se paga el rendimiento y cuándo el capital, con su franja
// de tiempo. Solo presenta el modelo: aquí no se calcula nada y no hay textos
// propios. Ningún texto nuevo baja de 7.5 pt.

const ALTO_LOGO = 26;
/**
 * Alto de cada fila de la tabla y de los renglones de las tarjetas. Bajó de
 * 10.5 a 10 en el Sprint 6b (decisión de Fernando) para que, con 24 meses, la
 * nota de día inhábil quepa en la página 2; la letra no cambia.
 */
const ALTO_FILA = 10;
/** Ancho de cada columna: la mitad del ancho útil (540 pt) menos la separación. */
const ANCHO_COLUMNA = LIENZO_GRAFICA.ancho;
/** Alto de cada renglón del comparativo (una línea de 7.5 pt y su barra). */
const ALTO_BARRA = 11;
/** x donde empiezan las barras: después de la columna de nombres. */
const INICIO_BARRA = LIENZO_BENCHMARK.anchoEtiqueta + 4;

/**
 * Filas del calendario mensual que caben en la página 2. Con más (plazo
 * especial de 25 a 60 meses), la tabla completa pasa a una tercera página.
 */
export const MESES_EN_PAGINA_2 = 24;

/** true si el calendario mensual no cabe en la página 2 y el PDF lleva una tercera página. */
export function llevaTerceraPagina(modelo: ModeloPagina2): boolean {
  const d = modelo.tarjetas[0].detalle;
  return d !== null && d.filas.length > MESES_EN_PAGINA_2;
}

const BANDA: Readonly<Record<TarjetaPdf["esquema"], string>> = {
  mensual: COLOR.bandaVerde,
  final_del_plazo: COLOR.bandaDorada,
};

const COLOR_SERIE: Readonly<Record<ColorSerie, string>> = {
  marino: COLOR.marino,
  verde: COLOR.verde,
  gris: COLOR.gris,
};

/** Continuo y rayado (modalidad 2): se distinguen sin depender del color. */
const RAYADO: Readonly<Record<TrazoSerie, string | undefined>> = {
  continuo: undefined,
  rayado: "5 2.5",
  punteado: "1.2 2",
};

const e = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: COLOR.marino,
  },
  titulo: { fontSize: 14, fontWeight: "bold", color: COLOR.marino },

  columnas: { marginTop: 10, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  columna: { width: ANCHO_COLUMNA, gap: 10 },

  tarjeta: { width: ANCHO_COLUMNA, borderWidth: 0.75, borderColor: COLOR.linea, borderRadius: 6 },
  banda: { paddingVertical: 4, paddingHorizontal: 8, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  bandaTexto: { fontSize: 8.5, fontWeight: "bold", color: COLOR.blanco, lineHeight: 1.2 },
  cuerpo: { paddingTop: 5, paddingBottom: 6, paddingHorizontal: 8 },
  filaTasa: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tasa: { fontSize: 24, fontWeight: "bold", color: COLOR.marino, lineHeight: 1.1 },
  tasaEtiqueta: { fontSize: 7, color: COLOR.gris, fontWeight: "bold" },
  /** Píldora: lineHeight 1 y un punto más de relleno arriba para que Nunito quede centrada. */
  insignia: {
    paddingTop: 3.5,
    paddingBottom: 2.5,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: COLOR.marino,
    color: COLOR.blanco,
    fontSize: 7,
    fontWeight: "bold",
    lineHeight: 1,
  },
  renglones: { marginTop: 4, marginBottom: 4 },
  renglon: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // Altura mínima: una etiqueta larga junto a una cifra larga (USD) se parte en dos líneas en vez de encimarse.
    minHeight: ALTO_FILA,
    gap: 6,
    fontSize: 8,
    lineHeight: 1,
  },
  renglonTotal: { fontWeight: "bold", borderTopWidth: 0.75, borderTopColor: COLOR.linea },
  renglonEtiqueta: { flexShrink: 1 },
  renglonCifra: { fontWeight: "bold", flexShrink: 0 },
  linea: { fontSize: 7.5, color: COLOR.marino, lineHeight: 1.3 },
  franja: { marginTop: 3, marginBottom: 4 },

  tablaCabeza: {
    flexDirection: "row",
    alignItems: "center",
    height: ALTO_FILA + 2,
    paddingHorizontal: 4,
    backgroundColor: COLOR.marino,
    color: COLOR.blanco,
    fontSize: 7.5,
    fontWeight: "bold",
    lineHeight: 1,
  },
  tablaFila: { flexDirection: "row", alignItems: "center", height: ALTO_FILA, paddingHorizontal: 4, fontSize: 7.5, lineHeight: 1 },
  tablaFilaAlterna: { backgroundColor: COLOR.fondoTenue },
  colFecha: { width: 50 },
  colDias: { width: 24, textAlign: "right" },
  colCifra: { flex: 1, textAlign: "right" },
  notaTarjeta: { fontSize: 8, color: COLOR.gris, lineHeight: 1.3 },

  notaCentavos: { marginTop: 4, fontSize: 7, color: COLOR.gris, lineHeight: 1.2 },
  /** La misma nota en la tercera página, donde toda la letra es de 7.5 pt o más. */
  notaCentavosGrande: { marginTop: 6, fontSize: 7.5, color: COLOR.gris, lineHeight: 1.2 },

  grafica: { width: LIENZO_GRAFICA.ancho },
  graficaCabeza: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6, height: 16 },
  graficaTitulo: { fontSize: 9, fontWeight: "bold", color: COLOR.marino },
  leyenda: { marginTop: 3, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  leyendaElemento: { flexDirection: "row", alignItems: "center", gap: 3 },
  leyendaTexto: { fontSize: 6.5, color: COLOR.marino },
  omision: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: COLOR.fondoTenue,
    borderRadius: 6,
    fontSize: 8,
    color: COLOR.marino,
    lineHeight: 1.3,
  },
  notaGrafica: { marginTop: 2, fontSize: 6.5, color: COLOR.gris, lineHeight: 1.3 },

  benchmark: { width: ANCHO_COLUMNA },
  notasBenchmark: { marginTop: 1 },
  benchmarkGrupo: { marginTop: 3, fontSize: 7.5, fontWeight: "bold", color: COLOR.marino },
  barras: { marginTop: 2, marginBottom: 1 },
  benchmarkNota: { marginTop: 0.5, fontSize: 7.5, color: COLOR.gris, lineHeight: 1.2 },

  /** Empuja el pie al final de la hoja. */
  relleno: { flexGrow: 1, minHeight: 8 },
  pie: { fontSize: 7.5, color: COLOR.gris, lineHeight: 1.2 },
});

const textoSvg = (fontSize: number, fontWeight: "normal" | "bold" = "normal") => ({ fontSize, fontFamily: FAMILIA, fontWeight });

/** Franja de tiempo: un punto por pago, del mes 1 al mes N, con sus rótulos. */
function Franja({ f }: { f: FranjaPdf }) {
  const { ancho, alto, y } = LIENZO_FRANJA;
  const ultimo = f.puntos[f.puntos.length - 1];
  return (
    <Svg width={ancho} height={alto} style={e.franja}>
      <Line x1={f.inicio} y1={y} x2={f.fin} y2={y} stroke={COLOR.linea} strokeWidth={1.2} />
      <Circle cx={f.inicio} cy={y} r={1.6} fill={COLOR.gris} />
      {f.puntos.map((p) => (
        <Circle key={p.mes} cx={p.x} cy={y} r={p === ultimo ? 3 : 2} fill={p === ultimo ? COLOR.verde : COLOR.marino} />
      ))}
      {f.etiquetaPuntos !== null && (
        <Text x={f.inicio} y={y + 13} fill={COLOR.marino} style={textoSvg(7.5)}>
          {f.etiquetaPuntos}
        </Text>
      )}
      <Text x={ultimo.x + 5} y={y + 13} textAnchor="end" fill={COLOR.verde} style={textoSvg(7.5, "bold")}>
        {f.etiquetaFinal}
      </Text>
    </Svg>
  );
}

/** La tabla por fechas de pago de la modalidad 1: encabezado y filas alternadas. */
function TablaMensual({ filas, textos }: { filas: NonNullable<TarjetaPdf["detalle"]>["filas"]; textos: ModeloPagina2["textos"] }) {
  return (
    <>
      <View style={e.tablaCabeza}>
        <Text style={e.colFecha}>{textos.columnaFechaPago}</Text>
        <Text style={e.colDias}>{textos.columnaDias}</Text>
        <Text style={e.colCifra}>{textos.columnaRendimientoMensual}</Text>
        <Text style={e.colCifra}>{textos.columnaRendimientoAcumulado}</Text>
      </View>
      {filas.map((f, i) => (
        <View key={f.fecha} style={[e.tablaFila, ...(i % 2 === 1 ? [e.tablaFilaAlterna] : [])]}>
          <Text style={e.colFecha}>{f.fecha}</Text>
          <Text style={e.colDias}>{f.dias}</Text>
          <Text style={e.colCifra}>{f.rendimiento}</Text>
          <Text style={e.colCifra}>{f.acumulado}</Text>
        </View>
      ))}
    </>
  );
}

/** Con conTabla falso (más de 24 meses), la tarjeta no lleva la tabla mes a mes: va en la tercera página. */
function Tarjeta({ t, textos, conTabla = true }: { t: TarjetaPdf; textos: ModeloPagina2["textos"]; conTabla?: boolean }) {
  const d = t.detalle;
  return (
    <View style={e.tarjeta} wrap={false}>
      <View style={[e.banda, { backgroundColor: BANDA[t.esquema] }]}>
        <Text style={e.bandaTexto}>{t.titulo}</Text>
      </View>
      <View style={e.cuerpo}>
        {d === null ? (
          <Text style={e.notaTarjeta}>{t.nota ?? ""}</Text>
        ) : (
          <>
            <View style={e.filaTasa}>
              <View>
                <Text style={e.tasa}>{d.tasa}</Text>
                <Text style={e.tasaEtiqueta}>{d.etiquetaTasa}</Text>
              </View>
              {t.elegida && <Text style={e.insignia}>{textos.insignia}</Text>}
            </View>
            <View style={e.renglones}>
              {d.renglones.map((r, i) => (
                <View key={r.etiqueta} style={[e.renglon, ...(i === d.renglones.length - 1 ? [e.renglonTotal] : [])]}>
                  <Text style={e.renglonEtiqueta}>{r.etiqueta}</Text>
                  <Text style={e.renglonCifra}>{r.cifra}</Text>
                </View>
              ))}
            </View>
            {/* El vencimiento va en el renglón del capital, para no sumar un renglón a la página 2. */}
            {[d.lineas[0], `${d.lineas[1]} · ${d.vencimiento}`].map((l) => (
              <Text key={l} style={e.linea}>
                {l}
              </Text>
            ))}
            <Franja f={d.franja} />
            {conTabla && d.filas.length > 0 && <TablaMensual filas={d.filas} textos={textos} />}
          </>
        )}
      </View>
    </View>
  );
}

/** Muestra del trazo de una serie, para la leyenda. */
function MuestraTrazo({ color, trazo }: { color: ColorSerie; trazo: TrazoSerie }) {
  return (
    <Svg width={16} height={6}>
      <Line x1={0} y1={3} x2={16} y2={3} stroke={COLOR_SERIE[color]} strokeWidth={1.6} strokeDasharray={RAYADO[trazo]} />
    </Svg>
  );
}

function Grafica({ g }: { g: GraficaPdf }) {
  const { ancho, alto, area } = LIENZO_GRAFICA;
  const d = g.dibujo;
  return (
    <View style={e.grafica} wrap={false}>
      <View style={e.graficaCabeza}>
        <Text style={e.graficaTitulo}>{g.titulo}</Text>
      </View>
      {d === null ? (
        <Text style={e.omision}>{g.omision ?? ""}</Text>
      ) : (
        <>
          <View style={e.leyenda}>
            {d.series.map((s) => (
              <View key={s.nombre} style={e.leyendaElemento}>
                <MuestraTrazo color={s.color} trazo={s.trazo} />
                <Text style={e.leyendaTexto}>{s.nombre}</Text>
              </View>
            ))}
          </View>
          <Svg width={ancho} height={alto}>
            {d.ejeY.map((m) => (
              <Line key={`y${m.texto}`} x1={area.izquierda} y1={m.y} x2={area.derecha} y2={m.y} stroke={COLOR.cuadricula} strokeWidth={0.6} />
            ))}
            <Line x1={area.izquierda} y1={area.abajo} x2={area.derecha} y2={area.abajo} stroke={COLOR.gris} strokeWidth={0.6} />
            {d.ejeY.map((m) => (
              <Text key={`ty${m.texto}`} x={area.izquierda - 3} y={m.y + 2} textAnchor="end" fill={COLOR.gris} style={textoSvg(6)}>
                {m.texto}
              </Text>
            ))}
            {d.ejeX.map((m) => (
              <Text key={`tx${m.texto}`} x={m.x} y={area.abajo + 9} textAnchor="middle" fill={COLOR.gris} style={textoSvg(6)}>
                {m.texto}
              </Text>
            ))}
            <Text x={(area.izquierda + area.derecha) / 2} y={area.abajo + 19} textAnchor="middle" fill={COLOR.gris} style={textoSvg(6.5)}>
              {d.tituloEjeX}
            </Text>
            {d.series.map((s) => (
              <Path
                key={s.nombre}
                d={s.ruta}
                fill="none"
                stroke={COLOR_SERIE[s.color]}
                strokeWidth={s.trazo === "punteado" ? 1.4 : 1.8}
                strokeDasharray={RAYADO[s.trazo]}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {d.series.map((s) => (
              <Text key={`f${s.nombre}`} x={s.final.x} y={s.final.y + 2} fill={COLOR.marino} style={textoSvg(6.5, "bold")}>
                {s.final.texto}
              </Text>
            ))}
          </Svg>
        </>
      )}
      {g.nota !== null && <Text style={e.notaGrafica}>{g.nota}</Text>}
    </View>
  );
}

/** Alto de una fila con su fecha debajo (dos líneas de 7.5 pt). */
const ALTO_BARRA_CON_FECHA = 18.5;
const altoFila = (x: BarraBenchmark) => (x.detalle === null ? ALTO_BARRA : ALTO_BARRA_CON_FECHA);

/**
 * Un grupo del comparativo: título y barras de mayor a menor, cada una con su
 * fecha debajo. El grupo histórico lleva sus avisos aquí mismo; los del grupo
 * de última tasa van con las notas, en la columna izquierda (NotasBenchmark).
 */
function GrupoBarras({ g }: { g: GrupoBenchmark }) {
  const historico = g.clave === "rendimiento_historico";
  const alturas = g.barras.map(altoFila);
  const y0 = alturas.map((_, i) => alturas.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <View wrap={false}>
      <Text style={e.benchmarkGrupo}>{g.titulo}</Text>
      {/* En SVG: el texto dentro de filas con flex se mide de más en react-pdf. */}
      <Svg width={ANCHO_COLUMNA} height={alturas.reduce((a, b) => a + b, 0)} style={e.barras}>
        {g.barras.map((x, i) => {
          const y = y0[i];
          return (
            <Fragment key={x.nombre}>
              <Text x={0} y={y + 7.5} fill={COLOR.marino} style={textoSvg(7.5, x.tuya ? "bold" : "normal")}>
                {x.nombre}
              </Text>
              {/* Tu tasa: relleno sólido y borde grueso; las demás, contorno fino; el histórico, contorno punteado sobre blanco. */}
              <Rect
                x={INICIO_BARRA}
                y={y + 1.5}
                width={Math.max(x.ancho, 0.5)}
                height={LIENZO_BENCHMARK.altoBarra}
                fill={x.tuya ? COLOR.marino : historico ? COLOR.blanco : COLOR.fondoTenue}
                stroke={x.tuya ? COLOR.marino : COLOR.gris}
                strokeWidth={x.tuya ? 1.5 : 0.75}
                strokeDasharray={historico ? "2 1.5" : undefined}
              />
              <Text x={ANCHO_COLUMNA} y={y + 7.5} textAnchor="end" fill={COLOR.marino} style={textoSvg(7.5, x.tuya ? "bold" : "normal")}>
                {x.tasa}
              </Text>
              {x.detalle !== null && (
                <Text x={0} y={y + 16.5} fill={COLOR.gris} style={textoSvg(7.5)}>
                  {x.detalle}
                </Text>
              )}
            </Fragment>
          );
        })}
      </Svg>
      {historico &&
        g.leyendas.map((n) => (
          <Text key={n} style={e.benchmarkNota}>
            {n}
          </Text>
        ))}
    </View>
  );
}

/** Comparativo de tasas, columna derecha: título y los dos grupos de barras. */
function Benchmark({ b }: { b: BenchmarkPdf }) {
  return (
    <View style={e.benchmark}>
      <View style={e.graficaCabeza}>
        <Text style={e.graficaTitulo}>{b.titulo}</Text>
      </View>
      {b.tipo === "omitido" ? (
        <Text style={e.omision}>{b.texto}</Text>
      ) : (
        <>
          {b.grupos.map((g) => (
            <GrupoBarras key={g.clave} g={g} />
          ))}
        </>
      )}
    </View>
  );
}

/**
 * Notas del comparativo, columna izquierda (debajo de la tabla, donde sobra
 * espacio): fecha de actualización, avisos de la última tasa publicada,
 * asteriscos y fuentes.
 */
function NotasBenchmark({ b }: { b: BenchmarkPdf }) {
  if (b.tipo === "omitido") return null;
  const vigentes = b.grupos.filter((g) => g.clave !== "rendimiento_historico").flatMap((g) => g.leyendas);
  return (
    <View style={e.notasBenchmark}>
      {[b.actualizado, ...vigentes, b.notaNeta, ...b.notas, b.fuentes].map((n) => (
        <Text key={n} style={e.benchmarkNota}>
          {n}
        </Text>
      ))}
    </View>
  );
}

/** Contenido de la página 2 (va dentro de su <Page>). El pie es el mismo de la página 1. */
export function PaginaCalendario({
  modelo,
  logo,
  pie,
}: {
  modelo: ModeloPagina2 & { readonly benchmark: BenchmarkPdf };
  logo: LogoPdf;
  pie: { readonly sipres: string; readonly avisoFondo: string; readonly notaNeta: string };
}) {
  const { textos } = modelo;
  const [m1, m2] = modelo.tarjetas;
  const tercera = llevaTerceraPagina(modelo);
  return (
    <>
      <View style={e.encabezado}>
        <Logo logo={logo} alto={ALTO_LOGO} />
        <Text style={e.titulo}>{textos.titulo}</Text>
      </View>

      <View style={e.columnas}>
        <View style={e.columna}>
          <Tarjeta t={m1} textos={textos} conTabla={!tercera} />
          {/* Juntas, sin el espacio entre bloques de la columna. Con tercera página, la nota de centavos va allá. */}
          <View>
            {!tercera && <Text style={e.notaCentavos}>{`${textos.notaCentavos} ${textos.notaDiaInhabil}`}</Text>}
            <NotasBenchmark b={modelo.benchmark} />
          </View>
        </View>
        <View style={e.columna}>
          <Tarjeta t={m2} textos={textos} />
          {modelo.graficas.map((g) => (
            <Grafica key={g.titulo} g={g} />
          ))}
          <Benchmark b={modelo.benchmark} />
        </View>
      </View>

      <View style={e.relleno} />
      <View>
        <Text style={e.pie}>{pie.sipres}</Text>
        {/* La nota de la tasa neta va en el mismo párrafo del disclaimer, después de él. */}
        <Text style={e.pie}>{`${pie.avisoFondo} ${pie.notaNeta}`}</Text>
      </View>
    </>
  );
}

/**
 * Página 3 (solo con más de 24 meses): el calendario mensual completo de la
 * modalidad 1, repartido en dos columnas, con el mismo encabezado y pie. Toda
 * la letra es de 7.5 pt o más.
 */
export function PaginaCalendarioMensual({
  modelo,
  logo,
  pie,
}: {
  modelo: ModeloPagina2;
  logo: LogoPdf;
  pie: { readonly sipres: string; readonly avisoFondo: string; readonly notaNeta: string };
}) {
  const { textos } = modelo;
  const m1 = modelo.tarjetas[0];
  const filas = m1.detalle?.filas ?? [];
  const mitad = Math.ceil(filas.length / 2);
  return (
    <>
      <View style={e.encabezado}>
        <Logo logo={logo} alto={ALTO_LOGO} />
        <Text style={e.titulo}>{textos.titulo}</Text>
      </View>

      <View style={[e.banda, { backgroundColor: BANDA[m1.esquema], marginTop: 10, borderRadius: 4 }]}>
        <Text style={e.bandaTexto}>{m1.titulo}</Text>
      </View>
      <View style={e.columnas}>
        {[filas.slice(0, mitad), filas.slice(mitad)].map((parte, i) => (
          <View key={i} style={e.columna}>
            {parte.length > 0 && (
              <View>
                <TablaMensual filas={parte} textos={textos} />
              </View>
            )}
          </View>
        ))}
      </View>
      <Text style={e.notaCentavosGrande}>{textos.notaCentavos}</Text>
      <Text style={e.notaCentavosGrande}>{textos.notaDiaInhabil}</Text>

      <View style={e.relleno} />
      <View>
        <Text style={e.pie}>{pie.sipres}</Text>
        {/* La nota de la tasa neta va en el mismo párrafo del disclaimer, después de él. */}
        <Text style={e.pie}>{`${pie.avisoFondo} ${pie.notaNeta}`}</Text>
      </View>
    </>
  );
}
