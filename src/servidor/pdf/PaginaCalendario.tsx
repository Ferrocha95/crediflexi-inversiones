import "server-only";
import { Image, Line, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import {
  LIENZO_GRAFICA,
  type ColorSerie,
  type GraficaPdf,
  type ModeloPagina2,
  type TarjetaPdf,
  type TrazoSerie,
} from "../../aplicacion/pagina2";
import { COLOR_PDF as COLOR } from "./colores";
import { FAMILIA } from "./fuente";

// Página 2 del PDF: calendario de las dos modalidades y las dos gráficas.
// Solo presenta el modelo: aquí no se calcula nada y no hay textos propios.

const ALTO_LOGO = 26;
/** Proporción del PNG del logo (1834 × 539). */
const ANCHO_LOGO = (ALTO_LOGO * 1834) / 539;
/** Alto de cada fila de las tablas y de los renglones de las tarjetas. */
const ALTO_FILA = 12;

const BANDA: Readonly<Record<TarjetaPdf["esquema"], string>> = {
  mensual: COLOR.bandaVerde,
  final_del_plazo: COLOR.bandaDorada,
};

const COLOR_SERIE: Readonly<Record<ColorSerie, string>> = {
  marino: COLOR.marino,
  verde: COLOR.verde,
  gris: COLOR.gris,
};

/** Continuo, rayado (modalidad 2) y punteado (sin reinvertir): se distinguen sin depender del color. */
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
  logo: { height: ALTO_LOGO, width: ANCHO_LOGO, backgroundColor: COLOR.blanco },
  titulo: { fontSize: 14, fontWeight: "bold", color: COLOR.marino },

  tarjetas: { marginTop: 10, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tarjeta: { flex: 1, borderWidth: 0.75, borderColor: COLOR.linea, borderRadius: 6 },
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
  renglones: { marginTop: 4, marginBottom: 5 },
  renglon: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: ALTO_FILA,
    fontSize: 8,
    lineHeight: 1,
  },
  renglonTotal: { fontWeight: "bold", borderTopWidth: 0.75, borderTopColor: COLOR.linea },
  renglonCifra: { fontWeight: "bold" },

  tablaCabeza: {
    flexDirection: "row",
    alignItems: "center",
    height: ALTO_FILA + 2,
    paddingHorizontal: 4,
    backgroundColor: COLOR.marino,
    color: COLOR.blanco,
    fontSize: 7,
    fontWeight: "bold",
    lineHeight: 1,
  },
  tablaFila: { flexDirection: "row", alignItems: "center", height: ALTO_FILA, paddingHorizontal: 4, fontSize: 7.5, lineHeight: 1 },
  tablaFilaAlterna: { backgroundColor: COLOR.fondoTenue },
  colMes: { width: 30 },
  colCifra: { flex: 1, textAlign: "right" },
  notaTarjeta: { fontSize: 8, color: COLOR.gris, lineHeight: 1.3 },

  notaCentavos: { marginTop: 4, fontSize: 7, color: COLOR.gris },

  graficas: { marginTop: 10, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  grafica: { width: LIENZO_GRAFICA.ancho },
  /** Alto fijo: con o sin rótulo, las dos gráficas empiezan a la misma altura. */
  graficaCabeza: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6, height: 16 },
  graficaTitulo: { fontSize: 9, fontWeight: "bold", color: COLOR.marino },
  rotulo: {
    paddingTop: 2.5,
    paddingBottom: 1.5,
    paddingHorizontal: 6,
    borderRadius: 6,
    lineHeight: 1,
    borderWidth: 0.75,
    borderColor: COLOR.gris,
    fontSize: 6.5,
    fontWeight: "bold",
    color: COLOR.gris,
  },
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
});

function Tarjeta({ t, textos }: { t: TarjetaPdf; textos: ModeloPagina2["textos"] }) {
  return (
    <View style={e.tarjeta} wrap={false}>
      <View style={[e.banda, { backgroundColor: BANDA[t.esquema] }]}>
        <Text style={e.bandaTexto}>{t.titulo}</Text>
      </View>
      <View style={e.cuerpo}>
        {t.detalle === null ? (
          <Text style={e.notaTarjeta}>{t.nota ?? ""}</Text>
        ) : (
          <>
            <View style={e.filaTasa}>
              <View>
                <Text style={e.tasa}>{t.detalle.tasa}</Text>
                <Text style={e.tasaEtiqueta}>{textos.tasaAnual}</Text>
              </View>
              {t.elegida && <Text style={e.insignia}>{textos.insignia}</Text>}
            </View>
            <View style={e.renglones}>
              {t.detalle.renglones.map((r, i) => (
                <View key={r.etiqueta} style={[e.renglon, ...(i === 2 ? [e.renglonTotal] : [])]}>
                  <Text>{r.etiqueta}</Text>
                  <Text style={e.renglonCifra}>{r.cifra}</Text>
                </View>
              ))}
            </View>
            <View style={e.tablaCabeza}>
              <Text style={e.colMes}>{textos.columnaMes}</Text>
              <Text style={e.colCifra}>{textos.columnaRendimientoMes}</Text>
              <Text style={e.colCifra}>{textos.columnaRendimientoAcumulado}</Text>
            </View>
            {t.detalle.filas.map((f, i) => (
              <View key={f.mes} style={[e.tablaFila, ...(i % 2 === 1 ? [e.tablaFilaAlterna] : [])]}>
                <Text style={e.colMes}>{f.mes}</Text>
                <Text style={e.colCifra}>{f.rendimiento}</Text>
                <Text style={e.colCifra}>{f.acumulado}</Text>
              </View>
            ))}
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

const textoSvg = (fontSize: number, fontWeight: "normal" | "bold" = "normal") => ({ fontSize, fontFamily: FAMILIA, fontWeight });

function Grafica({ g }: { g: GraficaPdf }) {
  const { ancho, alto, area } = LIENZO_GRAFICA;
  const d = g.dibujo;
  return (
    <View style={e.grafica} wrap={false}>
      <View style={e.graficaCabeza}>
        <Text style={e.graficaTitulo}>{g.titulo}</Text>
        {g.rotulo !== null && <Text style={e.rotulo}>{g.rotulo}</Text>}
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
            {d.lineaVertical !== null && (
              <>
                <Line
                  x1={d.lineaVertical.x}
                  y1={area.arriba}
                  x2={d.lineaVertical.x}
                  y2={area.abajo}
                  stroke={COLOR.gris}
                  strokeWidth={0.75}
                  strokeDasharray="2 2"
                />
                <Text x={d.lineaVertical.x - 3} y={area.arriba + 6} textAnchor="end" fill={COLOR.gris} style={textoSvg(6)}>
                  {d.lineaVertical.texto}
                </Text>
              </>
            )}
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

/** Contenido de la página 2 (va dentro de su <Page>). */
export function PaginaCalendario({ modelo, logo }: { modelo: ModeloPagina2; logo: Buffer }) {
  const { textos } = modelo;
  return (
    <>
      <View style={e.encabezado}>
        {/* El PNG tiene fondo blanco sólido: siempre va sobre blanco. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML */}
        <Image src={{ data: logo, format: "png" }} style={e.logo} />
        <Text style={e.titulo}>{textos.titulo}</Text>
      </View>

      <View style={e.tarjetas}>
        {modelo.tarjetas.map((t) => (
          <Tarjeta key={t.esquema} t={t} textos={textos} />
        ))}
      </View>
      <Text style={e.notaCentavos}>{textos.notaCentavos}</Text>

      <View style={e.graficas}>
        {modelo.graficas.map((g) => (
          <Grafica key={g.titulo} g={g} />
        ))}
      </View>
    </>
  );
}
