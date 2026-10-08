import "server-only";
import { Document, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ModeloReclutamiento } from "../../aplicacion/reclutamiento";
import { COLOR_PDF as COLOR } from "./colores";
import { Logo, type LogoPdf } from "./Encabezado";
import { FAMILIA } from "./fuente";

// "Propuesta de ingresos" del modo reclutamiento: una sola hoja carta, visual.
// Solo presenta el modelo: aquí no se calcula nada y no hay textos propios
// (todo sale de seed/textos_cotizacion.json, bloque reclutamiento). Nada baja
// de 8 pt. El aviso interno de RH sobre las frases nunca va aquí.

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
          <Text style={e.tarjetaEtiqueta}>{t.tituloResultado}</Text>
          <Text style={e.tarjetaCifra}>{m.cifra.total}</Text>
          <Text style={e.tarjetaDetalle}>{m.cifra.detalle}</Text>
          {m.mezcla?.map((l) => (
            <Text key={l.plazo} style={e.tarjetaMezcla}>
              {l.plazo}: {l.operacion}
            </Text>
          ))}
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
                <Text style={e.plazoCifra}>{p.comision}</Text>
              </View>
              <Text style={e.plazoLinea}>{p.linea}</Text>
            </View>
          ))}
          {m.fraseVeces !== null && <Text style={e.veces}>{m.fraseVeces}</Text>}
        </View>

        {/* Escalera de bonos, con la captación del ejemplo resaltada; el aviso de incorporación va SOLO aquí. */}
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
          <Text style={e.incorporacion}>{m.avisoIncorporacion}</Text>
        </View>

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
