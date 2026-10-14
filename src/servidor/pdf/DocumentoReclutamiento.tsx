import "server-only";
import { Document, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ModeloReclutamiento } from "../../aplicacion/reclutamiento";
import { COLOR_PDF as COLOR } from "./colores";
import { Logo, type LogoPdf } from "./Encabezado";
import { FAMILIA } from "./fuente";

// "Propuesta de ingresos" del modo reclutamiento: una sola hoja carta, visual.
// Solo presenta el modelo: aquí no se calcula nada y no hay textos propios
// (todo sale de seed/textos_cotizacion.json, bloque reclutamiento). Nada baja
// de 8 pt. Los avisos internos de RH (frases y textos para internos) nunca van
// aquí. Externo: escalera de bonos y aviso de incorporación. Interno (Sprint
// 7a): total con sueldo base (propuesta), desbloqueo y tabla de bonos.

const MARGEN = 36;
const ANCHO_UTIL = 612 - 2 * MARGEN;
const ALTO_LOGO = 40;

/** Comparativo por plazos: rótulo a la izquierda, barra y comisión a la derecha. */
const PLAZOS = { anchoRotulo: 62, anchoCifra: 96, grosor: 12 } as const;
const ANCHO_BARRA = ANCHO_UTIL - PLAZOS.anchoRotulo - PLAZOS.anchoCifra - 12;

/** Escalera de bonos: un escalón por rango, cada uno más alto que el anterior. */
const ESCALERA = { separacion: 8, altoBase: 52, subida: 12 } as const;

const e = StyleSheet.create({
  pagina: {
    paddingTop: MARGEN,
    paddingBottom: MARGEN,
    paddingHorizontal: MARGEN,
    backgroundColor: COLOR.blanco,
    color: COLOR.marino,
    fontFamily: FAMILIA,
    fontSize: 10,
    lineHeight: 1.3,
  },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fecha: { alignItems: "flex-end" },
  fechaEtiqueta: { fontSize: 8, color: COLOR.gris },
  fechaValor: { fontSize: 11, color: COLOR.gris, fontWeight: "bold" },
  linea: { marginTop: 10, height: 3, backgroundColor: COLOR.verde, borderRadius: 1.5 },

  titulo: { marginTop: 10, fontSize: 22, fontWeight: "bold", lineHeight: 1.1 },
  presenta: { marginTop: 3, fontSize: 11, color: COLOR.gris },
  frase: { marginTop: 4, fontSize: 12, fontWeight: "bold", color: COLOR.verde },

  tarjeta: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: COLOR.fondoVerde,
    borderRadius: 10,
    borderLeftWidth: 6,
    borderLeftColor: COLOR.verde,
  },
  tarjetaEtiqueta: { fontSize: 10, color: COLOR.gris },
  tarjetaCifra: { fontSize: 34, fontWeight: "bold", color: COLOR.verde, lineHeight: 1.15 },
  tarjetaDetalle: { fontSize: 11 },
  tarjetaMezcla: { marginTop: 2, fontSize: 8.5, color: COLOR.gris },

  seccion: { marginTop: 12 },
  seccionTitulo: { fontSize: 13, fontWeight: "bold", marginBottom: 4 },

  plazo: { marginTop: 3 },
  plazoFila: { flexDirection: "row", alignItems: "center" },
  plazoRotulo: { width: PLAZOS.anchoRotulo, fontSize: 10, fontWeight: "bold" },
  plazoCifra: { width: PLAZOS.anchoCifra, fontSize: 11, fontWeight: "bold", textAlign: "right" },
  plazoLinea: { marginLeft: PLAZOS.anchoRotulo + 6, fontSize: 8.5, color: COLOR.gris, lineHeight: 1.2 },
  veces: { marginTop: 6, fontSize: 11, fontWeight: "bold" },

  escalera: { flexDirection: "row", alignItems: "flex-end", gap: ESCALERA.separacion },
  escalon: { flex: 1, padding: 7, borderRadius: 6, borderWidth: 1, borderColor: COLOR.linea, backgroundColor: COLOR.fondoMarino },
  escalonActual: { borderColor: COLOR.verde, borderWidth: 2, backgroundColor: COLOR.fondoVerde },
  escalonMarca: { fontSize: 8, fontWeight: "bold", color: COLOR.verde, marginBottom: 2 },
  escalonTexto: { fontSize: 8.5, lineHeight: 1.25 },
  escalonTextoActual: { fontWeight: "bold" },
  incorporacion: { marginTop: 6, fontSize: 9, color: COLOR.marino, lineHeight: 1.3 },

  desglose: { marginTop: 4, flexDirection: "row", gap: 14 },
  desgloseEtiqueta: { fontSize: 8.5, color: COLOR.gris },
  desgloseValor: { fontSize: 11, fontWeight: "bold" },
  estado: { marginTop: 3, fontSize: 10, fontWeight: "bold" },
  bloqueada: { fontSize: 8.5, color: COLOR.gris, fontWeight: "normal" },
  filaTabla: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.linea, paddingVertical: 2.5 },
  encabezadoTabla: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.marino, paddingBottom: 2, fontSize: 9, fontWeight: "bold" },
  celda: { fontSize: 10 },
  derecha: { textAlign: "right" },
  alcanzada: { backgroundColor: COLOR.fondoVerde, fontWeight: "bold" },
  marcaAlcanzada: { fontSize: 8.5, color: COLOR.bandaVerde, fontWeight: "bold" },

  relleno: { flexGrow: 1, minHeight: 8 },
  avisos: {
    padding: 10,
    borderWidth: 1.25,
    borderColor: COLOR.marino,
    borderRadius: 8,
    backgroundColor: COLOR.fondoMarino,
    fontSize: 9,
    fontWeight: "bold",
    lineHeight: 1.35,
    gap: 3,
  },
});

export function DocumentoReclutamiento({ modelo: m, logo }: { modelo: ModeloReclutamiento; logo: LogoPdf }) {
  const t = m.textos;
  return (
    <Document title={t.pdfTitulo} language="es-MX">
      <Page size="LETTER" style={e.pagina}>
        <View style={e.encabezado}>
          <Logo logo={logo} alto={ALTO_LOGO} />
          <View style={e.fecha}>
            <Text style={e.fechaEtiqueta}>{t.pdfFecha}</Text>
            <Text style={e.fechaValor}>{m.fecha}</Text>
          </View>
        </View>
        <View style={e.linea} />

        <Text style={e.titulo}>{t.pdfTitulo}</Text>
        {m.presenta !== null && <Text style={e.presenta}>{m.presenta}</Text>}
        {m.frases.length > 0 && <Text style={e.frase}>{m.frases[0]}</Text>}

        {/* La cifra grande: comisión más bono, con el plazo (o la mezcla) en el detalle. */}
        <View style={e.tarjeta} wrap={false}>
          <Text style={e.tarjetaEtiqueta}>{m.tituloCifra}</Text>
          <Text style={e.tarjetaCifra}>{m.cifra.total}</Text>
          <Text style={e.tarjetaDetalle}>{m.cifra.detalle}</Text>
          {m.mezcla?.map((l) => (
            <Text key={l.plazo} style={e.tarjetaMezcla}>
              {l.plazo}: {l.operacion}
            </Text>
          ))}
          {/* Interno: desglose del total, cálculo y desbloqueo de la meta. */}
          {m.interno !== null && (
            <>
              <View style={e.desglose}>
                {[
                  [m.interno.rotuloSueldoBase, m.interno.sueldoBase],
                  [t.comisionInterno, m.interno.comision],
                  [t.bonoInterno, m.interno.bono],
                ].map(([etiqueta, valor]) => (
                  <View key={etiqueta}>
                    <Text style={e.desgloseEtiqueta}>{etiqueta}</Text>
                    <Text style={e.desgloseValor}>{valor}</Text>
                  </View>
                ))}
              </View>
              <Text style={e.tarjetaMezcla}>
                {t.calculo}: {m.interno.operacion}
              </Text>
              <Text style={e.estado}>{m.interno.estadoDesbloqueo}</Text>
              <Text style={e.tarjetaMezcla}>{m.interno.notaDesbloqueo}</Text>
            </>
          )}
        </View>

        {/* Comparativo por plazos: una barra y una sola línea por plazo. */}
        <View style={e.seccion} wrap={false}>
          <Text style={e.seccionTitulo}>{t.tituloComparativo}</Text>
          {m.comparativo.map((p) => (
            <View key={p.plazo} style={e.plazo}>
              <View style={e.plazoFila}>
                <Text style={e.plazoRotulo}>{p.etiqueta}</Text>
                <Svg width={ANCHO_BARRA} height={PLAZOS.grosor} style={{ marginHorizontal: 6 }}>
                  <Rect x={0} y={0} width={ANCHO_BARRA} height={PLAZOS.grosor} fill={COLOR.fondoMarino} />
                  {/* El plazo de la cifra grande: verde sólido con borde marino; los demás, verde con contorno fino. */}
                  <Rect
                    x={0}
                    y={0}
                    width={Math.max(p.fraccion * ANCHO_BARRA, 0.5)}
                    height={PLAZOS.grosor}
                    fill={COLOR.verde}
                    fillOpacity={p.elegido ? 1 : 0.45}
                    stroke={p.elegido ? COLOR.marino : COLOR.verde}
                    strokeWidth={p.elegido ? 1.5 : 0.5}
                  />
                </Svg>
                <Text style={e.plazoCifra}>
                  {p.comision}
                  {p.bloqueada && <Text style={e.bloqueada}> ({t.comparativoBloqueada})</Text>}
                </Text>
              </View>
              <Text style={e.plazoLinea}>{p.linea}</Text>
            </View>
          ))}
          {m.fraseVeces !== null && <Text style={e.veces}>{m.fraseVeces}</Text>}
        </View>

        {/* Interno: tabla de bonos con rangos y la fila alcanzada. */}
        {m.interno !== null && (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>{t.tituloBonosInterno}</Text>
            <View style={e.encabezadoTabla}>
              <Text style={[e.celda, { width: 200 }]}>{t.columnaCumplimiento}</Text>
              <Text style={[e.celda, e.derecha, { width: 110 }]}>{t.columnaDesde}</Text>
              <Text style={[e.celda, e.derecha, { width: 110 }]}>{t.columnaHasta}</Text>
              <Text style={[e.celda, e.derecha, { width: 120 }]}>{t.columnaBono}</Text>
            </View>
            {m.interno.bonos.map((b) => (
              <View key={b.desde} style={[e.filaTabla, ...(b.actual ? [e.alcanzada] : [])]}>
                <Text style={[e.celda, { width: 200 }]}>
                  {b.cumplimiento}
                  {b.actual && <Text style={e.marcaAlcanzada}> · {t.escalonActual}</Text>}
                </Text>
                <Text style={[e.celda, e.derecha, { width: 110 }]}>{b.desde}</Text>
                <Text style={[e.celda, e.derecha, { width: 110 }]}>{b.hasta}</Text>
                <Text style={[e.celda, e.derecha, { width: 120 }]}>{b.bono}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Externo: escalera de bonos, con la captación del ejemplo resaltada; el aviso de incorporación va SOLO aquí. */}
        {m.escalera.length > 0 && (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>{t.tituloBonos}</Text>
            <View style={e.escalera}>
              {m.escalera.map((x, i) => (
                <View key={x.texto} style={[e.escalon, { minHeight: ESCALERA.altoBase + i * ESCALERA.subida }, ...(x.actual ? [e.escalonActual] : [])]}>
                  {x.actual && <Text style={e.escalonMarca}>{t.escalonActual}</Text>}
                  <Text style={[e.escalonTexto, ...(x.actual ? [e.escalonTextoActual] : [])]}>{x.texto}</Text>
                </View>
              ))}
            </View>
            {m.avisoIncorporacion !== null && <Text style={e.incorporacion}>{m.avisoIncorporacion}</Text>}
          </View>
        )}

        <View style={e.relleno} />
        <View style={e.avisos}>
          <Text>{m.avisoInversiones}</Text>
          <Text>{m.aviso}</Text>
          <Text>{m.avisoTasas}</Text>
        </View>
      </Page>
    </Document>
  );
}
