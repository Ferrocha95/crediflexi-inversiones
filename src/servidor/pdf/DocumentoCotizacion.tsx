import "server-only";
import {
  Defs,
  Document,
  LinearGradient,
  Page,
  Rect,
  StyleSheet,
  Stop,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ModeloPdf } from "../../aplicacion/modelo";
import { COLOR_PDF as COLOR } from "./colores";
import { Logo, type LogoPdf } from "./Encabezado";
import { FAMILIA } from "./fuente";
import { llevaTerceraPagina, PaginaCalendario, PaginaCalendarioMensual } from "./PaginaCalendario";

// Solo presenta el modelo: aquí no se calcula nada y no hay textos propios.
// Todo texto sale de ModeloPdf (archivo de textos, semilla o cotización).

const MARGEN = 36;
const ANCHO_UTIL = 612 - 2 * MARGEN; // Carta: 612 × 792 pt.
const ALTO_LOGO = 46;
/** Separa la tasa y el plazo debajo de la cifra principal (signo tipográfico, no texto). */
const SEPARADOR = " \u00B7 ";
const HUECO_MAXIMO = 22;

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
  lineaMarca: { marginTop: 10 },

  titulo: { marginTop: 10, fontSize: 24, fontWeight: "bold", lineHeight: 1.1 },
  razonSocial: { marginTop: 4, fontSize: 10, color: COLOR.gris },
  preparadoPara: { marginTop: 6, fontSize: 13, color: COLOR.marino, lineHeight: 1.2 },
  preparadoParaEtiqueta: { color: COLOR.verde },
  preparadoParaNombre: { fontWeight: "bold" },
  fechaInicio: { marginTop: 2, fontSize: 10, color: COLOR.marino, lineHeight: 1.2 },

  tarjeta: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 20,
    backgroundColor: COLOR.fondoVerde,
    borderRadius: 10,
    borderLeftWidth: 6,
    borderLeftColor: COLOR.verde,
  },
  tarjetaEtiqueta: { fontSize: 10, color: COLOR.gris },
  tarjetaCifra: { marginTop: 1, fontSize: 36, fontWeight: "bold", color: COLOR.verde, lineHeight: 1.15 },
  tarjetaDetalle: { marginTop: 2, fontSize: 11, color: COLOR.marino },
  tarjetaLinea: { marginTop: 2, fontSize: 10, color: COLOR.marino },
  fuerte: { fontWeight: "bold" },

  resumen: { marginTop: 9, flexDirection: "row", gap: 8 },
  casilla: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLOR.fondoMarino,
    borderRadius: 8,
  },
  casillaEtiqueta: { fontSize: 8, color: COLOR.gris },
  casillaValor: { marginTop: 3, fontSize: 11, fontWeight: "bold", color: COLOR.marino, lineHeight: 1.2 },

  seccion: { marginTop: 10 },
  seccionTitulo: { fontSize: 13, fontWeight: "bold", marginBottom: 4 },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.linea,
  },
  filaAlterna: { backgroundColor: COLOR.fondoTenue },
  filaPrincipal: { backgroundColor: COLOR.fondoVerde, borderRadius: 6, borderBottomColor: COLOR.fondoVerde },
  filaEtiqueta: { flex: 1, paddingRight: 14, fontSize: 10.5 },
  filaCifra: { fontSize: 12, fontWeight: "bold" },
  filaCifraPrincipal: { color: COLOR.verde },

  calculo: {
    marginTop: 9,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: COLOR.fondoTenue,
    borderWidth: 0.75,
    borderColor: COLOR.linea,
    borderRadius: 8,
  },
  calculoCabeza: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
  calculoTitulo: { fontSize: 10, fontWeight: "bold" },
  calculoTasas: { fontSize: 8, color: COLOR.gris, textAlign: "right" },
  calculoFila: { flexDirection: "row", marginTop: 3, gap: 10 },
  calculoEtiqueta: { width: "34%", fontSize: 8.5, fontWeight: "bold" },
  calculoFormula: { width: "24%", fontSize: 8.5, color: COLOR.gris },
  calculoOperacion: { flex: 1, fontSize: 8.5, color: COLOR.marino },

  /**
   * Con poco contenido, el espacio libre se reparte entre las secciones (hasta
   * HUECO_MAXIMO cada una) y el resto empuja el pie al final de la hoja. Con
   * todo el contenido, los huecos quedan en cero.
   */
  hueco: { flexGrow: 1, maxHeight: HUECO_MAXIMO },
  relleno: { flexGrow: 1, minHeight: 6 },

  franja: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLOR.marino,
    borderRadius: 6,
  },
  franjaIzquierda: { flex: 1, fontSize: 9, color: COLOR.blanco },
  franjaDerecha: { maxWidth: "45%", fontSize: 9, color: COLOR.blanco, fontWeight: "bold", textAlign: "right" },
  /** Con el marginTop de pieNota, el primer renglón del pie queda a 5 pt de la franja. */
  pieTextos: { marginTop: 3 },
  pieNota: { marginTop: 2, fontSize: 8, color: COLOR.gris, lineHeight: 1.2 },

  /** En el margen inferior, fuera del flujo: no mueve nada del contenido de la página. */
  numeroPagina: {
    position: "absolute",
    bottom: 16,
    left: MARGEN,
    right: MARGEN,
    fontSize: 7.5,
    color: COLOR.gris,
    textAlign: "right",
  },
});

/** Línea fina con el degradado de la flecha del logo (rojo -> naranja -> amarillo). */
function LineaMarca() {
  return (
    <Svg width={ANCHO_UTIL} height={3} style={e.lineaMarca}>
      <Defs>
        <LinearGradient id="degradadoMarca" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={COLOR.rojo} />
          <Stop offset="0.5" stopColor={COLOR.naranja} />
          <Stop offset="1" stopColor={COLOR.amarillo} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={ANCHO_UTIL} height={3} rx={1.5} ry={1.5} fill="url(#degradadoMarca)" />
    </Svg>
  );
}

/**
 * "Página N de M", con las palabras del archivo de textos. El documento tiene
 * dos páginas, o tres con más de 24 meses (las pruebas lo exigen). El número
 * va escrito por página: el render dinámico de react-pdf no se dibujó en el
 * margen inferior.
 */
function NumeroPagina({ pagina, de, numero, total }: { pagina: string; de: string; numero: number; total: number }) {
  return <Text style={e.numeroPagina}>{`${pagina} ${numero} ${de} ${total}`}</Text>;
}

function Casilla({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={e.casilla}>
      <Text style={e.casillaEtiqueta}>{etiqueta}</Text>
      <Text style={e.casillaValor}>{valor}</Text>
    </View>
  );
}

export function DocumentoCotizacion({ modelo, logo }: { modelo: ModeloPdf; logo: LogoPdf }) {
  const { textos: t, cifraPrincipal, pie, pagina2 } = modelo;
  const tercera = llevaTerceraPagina(pagina2);
  const total = tercera ? 3 : 2;
  const numero = (n: number) => <NumeroPagina pagina={pagina2.textos.pagina} de={pagina2.textos.paginaDe} numero={n} total={total} />;
  const hayFranja = pie.preparadoPor !== null || pie.vigencia !== null;

  return (
    <Document title={t.titulo} author={modelo.encabezado.razonSocial} language="es-MX">
      <Page size="LETTER" style={e.pagina}>
        <View style={e.encabezado}>
          <Logo logo={logo} alto={ALTO_LOGO} />
          <View style={e.fecha}>
            <Text style={e.fechaEtiqueta}>{t.fecha}</Text>
            <Text style={e.fechaValor}>{modelo.fecha}</Text>
          </View>
        </View>
        <LineaMarca />

        <Text style={e.titulo}>{t.titulo}</Text>
        <Text style={e.razonSocial}>{modelo.encabezado.razonSocial}</Text>
        {modelo.preparadoPara !== null && (
          <Text style={e.preparadoPara}>
            <Text style={e.preparadoParaEtiqueta}>{t.preparadoPara} </Text>
            <Text style={e.preparadoParaNombre}>{modelo.preparadoPara}</Text>
          </Text>
        )}
        {/* Inmediatamente después del nombre del inversionista; sin nombre, en su lugar. */}
        <Text style={e.fechaInicio}>{modelo.fechaInicio}</Text>

        <View style={e.hueco} />
        <View style={e.tarjeta}>
          <Text style={e.tarjetaEtiqueta}>{cifraPrincipal.etiqueta}</Text>
          <Text style={e.tarjetaCifra}>{cifraPrincipal.cifra}</Text>
          <Text style={e.tarjetaDetalle}>
            {modelo.etiquetas.tasa} <Text style={e.fuerte}>{modelo.tasa}</Text>
            {SEPARADOR}
            {modelo.etiquetas.plazo} <Text style={e.fuerte}>{modelo.solicitud.plazo}</Text>
            {SEPARADOR}
            {modelo.lineaPago}
          </Text>
          {modelo.desgloseTasa !== null && <Text style={e.tarjetaLinea}>{modelo.desgloseTasa}</Text>}
        </View>

        <View style={e.hueco} />
        <View style={e.resumen}>
          <Casilla etiqueta={t.resumenMonto} valor={modelo.solicitud.monto} />
          <Casilla etiqueta={modelo.etiquetas.plazo} valor={modelo.solicitud.plazo} />
          <Casilla etiqueta={modelo.etiquetas.tasa} valor={modelo.tasa} />
          <Casilla etiqueta={t.resumenEsquema} valor={modelo.solicitud.esquema} />
        </View>

        <View style={e.hueco} />
        <View style={e.seccion}>
          <Text style={e.seccionTitulo}>{t.seccionResultados}</Text>
          {modelo.cifras.map((c, i) => {
            const principal = c.clave === cifraPrincipal.clave;
            return (
              <View
                key={c.clave}
                style={[e.fila, ...(i % 2 === 1 ? [e.filaAlterna] : []), ...(principal ? [e.filaPrincipal] : [])]}
              >
                <Text style={e.filaEtiqueta}>{c.etiqueta}</Text>
                <Text style={[e.filaCifra, ...(principal ? [e.filaCifraPrincipal] : [])]}>{c.cifra}</Text>
              </View>
            );
          })}
        </View>

        <View style={e.hueco} />
        <View style={e.calculo}>
          <View style={e.calculoCabeza}>
            <Text style={e.calculoTitulo}>{t.seccionCalculo}</Text>
            {/* La nota de días naturales va junto a la versión de las tasas, para no sumar un renglón a la página 1. */}
            <Text style={e.calculoTasas}>{`${modelo.lineaTasas} ${t.notaDiasNaturales}`}</Text>
          </View>
          {modelo.cifras.map((c) => (
            <View key={c.clave} style={e.calculoFila}>
              <Text style={e.calculoEtiqueta}>{c.etiquetaCalculo}</Text>
              <Text style={e.calculoFormula}>{c.formula}</Text>
              <Text style={e.calculoOperacion}>{c.operacion}</Text>
            </View>
          ))}
        </View>

        <View style={e.relleno} />

        <View>
          {hayFranja && (
            <View style={e.franja}>
              <Text style={e.franjaIzquierda}>{pie.preparadoPor ?? ""}</Text>
              {pie.vigencia !== null && <Text style={e.franjaDerecha}>{pie.vigencia}</Text>}
            </View>
          )}
          {/* Sprint 7d: sin el texto base; la versión y la fecha de las tasas siguen en "Cómo se calculó". */}
          <View style={e.pieTextos}>
            {pie.notaAdicional !== null && <Text style={e.pieNota}>{pie.notaAdicional}</Text>}
            {/* SIPRES (si la entidad lo lleva) y el aviso del fondo, en un solo párrafo para ahorrar renglones. */}
            <Text style={e.pieNota}>{pie.sipres}</Text>
            {/* La nota de la tasa neta va en el mismo párrafo del disclaimer, después de él. */}
            <Text style={e.pieNota}>{pie.avisoFondo}</Text>
          </View>
        </View>
        {numero(1)}
      </Page>

      <Page size="LETTER" style={e.pagina}>
        <PaginaCalendario modelo={pagina2} logo={logo} pie={pie} />
        {numero(2)}
      </Page>

      {tercera && (
        <Page size="LETTER" style={e.pagina}>
          <PaginaCalendarioMensual modelo={pagina2} logo={logo} pie={pie} />
          {numero(3)}
        </Page>
      )}
    </Document>
  );
}
