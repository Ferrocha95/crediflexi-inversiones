import "server-only";
import { Document, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ModeloReclutamiento } from "../../aplicacion/reclutamiento";
import { COLOR_PDF as COLOR } from "./colores";
import { Logo, type LogoPdf } from "./Encabezado";
import { FAMILIA } from "./fuente";

// "Propuesta de ingresos" del modo reclutamiento: una sola hoja carta. Solo
// presenta el modelo: aquí no se calcula nada y no hay textos propios (todo
// sale de seed/textos_cotizacion.json, bloque reclutamiento). Nada baja de 8 pt.

const MARGEN = 36;
const ANCHO_UTIL = 612 - 2 * MARGEN;
const ALTO_LOGO = 40;
const SEPARACION = 10;
const ANCHO_TARJETA = (ANCHO_UTIL - 2 * SEPARACION) / 3;

/** Gráfica de barras horizontales: nombre a la izquierda, total a la derecha. */
const BARRAS = { alto: 14, anchoNombre: 170, anchoTotal: 90, grosor: 9 } as const;
const ANCHO_BARRA = ANCHO_UTIL - BARRAS.anchoNombre - BARRAS.anchoTotal - 12;

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

  titulo: { marginTop: 10, fontSize: 24, fontWeight: "bold", lineHeight: 1.1 },
  presenta: { marginTop: 4, fontSize: 12, color: COLOR.gris },

  seccion: { marginTop: 12 },
  seccionTitulo: { fontSize: 13, fontWeight: "bold", marginBottom: 6 },

  tarjetas: { flexDirection: "row", gap: SEPARACION },
  tarjeta: {
    width: ANCHO_TARJETA,
    padding: 8,
    borderWidth: 0.75,
    borderColor: COLOR.linea,
    borderRadius: 8,
    backgroundColor: COLOR.fondoTenue,
  },
  tarjetaNombre: { fontSize: 10, fontWeight: "bold" },
  tarjetaEtiqueta: { marginTop: 4, fontSize: 8, color: COLOR.gris },
  tarjetaTotal: { fontSize: 18, fontWeight: "bold", color: COLOR.verde, lineHeight: 1.15 },
  desgloseTitulo: { marginTop: 4, fontSize: 8, fontWeight: "bold", color: COLOR.gris },
  desgloseLinea: { marginTop: 3, fontSize: 9 },
  desgloseOperacion: { fontSize: 8, color: COLOR.gris, lineHeight: 1.2 },
  sinCaptacion: { marginTop: 4, fontSize: 9, color: COLOR.gris },

  barraFila: { flexDirection: "row", alignItems: "center", height: BARRAS.alto },
  barraNombre: { width: BARRAS.anchoNombre, fontSize: 9 },
  barraTotal: { width: BARRAS.anchoTotal, fontSize: 9, fontWeight: "bold", textAlign: "right" },

  fechaPago: { marginTop: 2, fontSize: 10 },

  relleno: { flexGrow: 1, minHeight: 8 },
  aviso: {
    padding: 10,
    borderWidth: 1.25,
    borderColor: COLOR.marino,
    borderRadius: 8,
    backgroundColor: COLOR.fondoMarino,
    fontSize: 10,
    fontWeight: "bold",
    lineHeight: 1.35,
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

        <View style={e.seccion}>
          <Text style={e.seccionTitulo}>{t.tituloResultado}</Text>
          <View style={e.tarjetas}>
            {m.escenarios.map((s, i) => (
              <View key={i} style={e.tarjeta} wrap={false}>
                <Text style={e.tarjetaNombre}>{s.nombre}</Text>
                <Text style={e.tarjetaEtiqueta}>{t.comisionTotal}</Text>
                <Text style={e.tarjetaTotal}>{s.total}</Text>
                <Text style={e.desgloseTitulo}>{t.desglosePorPlazo}</Text>
                {s.lineas.length === 0 ? (
                  <Text style={e.sinCaptacion}>{t.sinCaptacion}</Text>
                ) : (
                  s.lineas.map((l) => (
                    <View key={l.plazo}>
                      <Text style={e.desgloseLinea}>
                        {l.plazo}: {l.comision}
                      </Text>
                      <Text style={e.desgloseOperacion}>{l.operacion}</Text>
                    </View>
                  ))
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={e.seccion} wrap={false}>
          <Text style={e.seccionTitulo}>{t.tituloGrafica}</Text>
          {m.grafica.map((b, i) => (
            <View key={i} style={e.barraFila}>
              <Text style={e.barraNombre}>{b.nombre}</Text>
              <Svg width={ANCHO_BARRA} height={BARRAS.grosor} style={{ marginHorizontal: 6 }}>
                <Rect x={0} y={0} width={ANCHO_BARRA} height={BARRAS.grosor} fill={COLOR.fondoMarino} />
                <Rect x={0} y={0} width={Math.max(b.fraccion * ANCHO_BARRA, 0)} height={BARRAS.grosor} fill={COLOR.verde} />
              </Svg>
              <Text style={e.barraTotal}>{b.total}</Text>
            </View>
          ))}
        </View>

        <View style={e.seccion}>
          <Text style={e.seccionTitulo}>{t.tituloFechas}</Text>
          {m.fechas.map((f) => (
            <Text key={f} style={e.fechaPago}>
              {f}
            </Text>
          ))}
        </View>

        <View style={e.relleno} />
        <View style={e.aviso}>
          <Text>{m.avisoInversiones}</Text>
          <Text style={{ marginTop: 4 }}>{m.aviso}</Text>
        </View>
      </Page>
    </Document>
  );
}
