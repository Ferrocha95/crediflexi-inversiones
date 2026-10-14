import "server-only";
import { Document, Line, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { FilaIncentivoModelo, ModeloPdfComisiones } from "../../aplicacion/comisiones";
import { rellenar } from "../../aplicacion/rellenar";
import { COLOR_PDF as COLOR } from "./colores";
import { Logo, type LogoPdf } from "./Encabezado";
import { FAMILIA } from "./fuente";

// PDF de la simulación de comisiones del mes (Sprint 7a): perfiles Gerente y
// Ejecutivo. Lleva todo lo que muestra la pantalla más el "Total estimado del
// mes (simulación)" y el aviso fijo. Solo presenta el modelo: aquí no se
// calcula nada y los textos salen de seed/textos_cotizacion.json (bloque
// comisiones). Nada baja de 8 pt. Máximo 2 páginas (50 inversiones por lista):
// las inversiones del equipo y de los externos van como suma, no línea por línea.

const MARGEN = 36;
const ANCHO_UTIL = 612 - 2 * MARGEN;
const ALTO_LOGO = 32;
const BARRA = { alto: 10 } as const;

/** Columnas de la tabla por inversión (anchos en puntos; suman ANCHO_UTIL). */
const COL = { numero: 20, tipo: 80, fecha: 62, monto: 92, plazo: 64, tasa: 52, comision: 86, pago: 84 } as const;

const e = StyleSheet.create({
  pagina: {
    paddingTop: MARGEN,
    paddingBottom: MARGEN,
    paddingHorizontal: MARGEN,
    backgroundColor: COLOR.blanco,
    color: COLOR.marino,
    fontFamily: FAMILIA,
    fontSize: 9,
    lineHeight: 1.3,
  },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fecha: { alignItems: "flex-end" },
  fechaEtiqueta: { fontSize: 8, color: COLOR.gris },
  fechaValor: { fontSize: 10, color: COLOR.gris, fontWeight: "bold" },
  linea: { marginTop: 6, height: 3, backgroundColor: COLOR.verde, borderRadius: 1.5 },

  titulo: { marginTop: 6, fontSize: 17, fontWeight: "bold", lineHeight: 1.1 },
  perfil: { marginTop: 2, fontSize: 10, color: COLOR.gris },

  tarjeta: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: COLOR.fondoVerde,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: COLOR.verde,
  },
  tarjetaFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  tarjetaEtiqueta: { fontSize: 10, fontWeight: "bold" },
  tarjetaCifra: { fontSize: 22, fontWeight: "bold", color: COLOR.verde, lineHeight: 1.1 },
  parte: { flexDirection: "row", justifyContent: "space-between", fontSize: 9 },
  operacion: { marginTop: 2, fontSize: 8, color: COLOR.gris },

  cifras: { marginTop: 6, flexDirection: "row", gap: 6 },
  cifra: { flex: 1, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: COLOR.linea, backgroundColor: COLOR.fondoMarino },
  cifraEtiqueta: { fontSize: 8, color: COLOR.gris },
  cifraValor: { fontSize: 10.5, fontWeight: "bold" },

  seccion: { marginTop: 7 },
  seccionTitulo: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  estado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  insignia: { fontSize: 9, fontWeight: "bold", paddingVertical: 1.5, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1 },
  insigniaSi: { color: COLOR.bandaVerde, borderColor: COLOR.bandaVerde, backgroundColor: COLOR.fondoVerde },
  insigniaNo: { color: COLOR.marino, borderColor: COLOR.marino, backgroundColor: COLOR.fondoMarino },
  marcas: { flexDirection: "row", justifyContent: "space-between", marginTop: 2, fontSize: 8, color: COLOR.gris },
  nota: { fontSize: 8.5, color: COLOR.gris, lineHeight: 1.3 },
  textoFuerte: { fontWeight: "bold" },

  filaTabla: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.linea, paddingVertical: 0.75 },
  encabezadoTabla: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.marino, paddingBottom: 2, fontWeight: "bold", fontSize: 8 },
  celda: { fontSize: 8, lineHeight: 1.15, paddingRight: 4 },
  derecha: { textAlign: "right" },
  /** Separa la columna de la anterior, que va alineada a la derecha. */
  separada: { paddingLeft: 8 },
  alcanzada: { backgroundColor: COLOR.fondoVerde, fontWeight: "bold" },
  marcaAlcanzada: { fontSize: 8, color: COLOR.bandaVerde, fontWeight: "bold" },

  dosColumnas: { flexDirection: "row", gap: 10 },
  columna: { flex: 1 },

  avisos: {
    marginTop: 8,
    padding: 6,
    borderWidth: 1.25,
    borderColor: COLOR.marino,
    borderRadius: 6,
    backgroundColor: COLOR.fondoMarino,
    fontSize: 9,
    fontWeight: "bold",
  },
});

/** "1, 2 y 3" (los números de inversión de un pago). */
function lista(ns: readonly number[]): string {
  return ns.length <= 1 ? ns.join("") : `${ns.slice(0, -1).join(", ")} y ${ns.at(-1)}`;
}

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={e.cifra}>
      <Text style={e.cifraEtiqueta}>{etiqueta}</Text>
      <Text style={e.cifraValor}>{valor}</Text>
    </View>
  );
}

function Insignia({ si, texto }: { si: boolean; texto: string }) {
  return <Text style={[e.insignia, si ? e.insigniaSi : e.insigniaNo]}>{texto}</Text>;
}

/** Fila de texto con la etiqueta a la izquierda y el monto a la derecha. */
function Renglon({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <View style={[e.parte, ...(fuerte ? [e.textoFuerte] : [])]}>
      <Text>{etiqueta}</Text>
      <Text>{valor}</Text>
    </View>
  );
}

export function DocumentoComisiones({ modelo, logo }: { modelo: ModeloPdfComisiones; logo: LogoPdf }) {
  const { textos: t, comisiones: m } = modelo;
  const rol = modelo.rol === "EJECUTIVO" ? t.pdfEjecutivo : t.pdfGerente;
  const etiquetaParte = { sueldoBase: t.sueldoBase, comisionPagable: t.totalComisionPagable, bono: t.totalBono } as const;
  const tipo = (x: "nueva" | "renovacion") => (x === "nueva" ? t.pdfNueva : t.pdfRenovacion);
  const a = m.avance;
  const r = m.regla;
  const anchoBarra = ANCHO_UTIL;
  const incentivo = (f: FilaIncentivoModelo) => rellenar(t.incentivoMasComision, { bono: f.bono });

  return (
    <Document title={t.pdfTitulo} language="es-MX">
      <Page size="LETTER" style={e.pagina}>
        <View style={e.encabezado}>
          <Logo logo={logo} alto={ALTO_LOGO} />
          <View style={e.fecha}>
            <Text style={e.fechaEtiqueta}>{t.pdfFecha}</Text>
            <Text style={e.fechaValor}>{modelo.fecha}</Text>
          </View>
        </View>
        <View style={e.linea} />

        <Text style={e.titulo}>{t.pdfTitulo}</Text>
        <Text style={e.perfil}>
          {t.pdfPerfil}: {t.pdfInterno} · {t.pdfRol}: {rol}
        </Text>

        {/* Total estimado del mes: sueldo base (solo ejecutivo) + comisión pagable + bono, con su desglose. */}
        <View style={e.tarjeta} wrap={false}>
          <View style={e.tarjetaFila}>
            <Text style={e.tarjetaEtiqueta}>{t.totalEstimadoMes}</Text>
            <Text style={e.tarjetaCifra}>{m.totalMes.total}</Text>
          </View>
          {m.totalMes.partes.map((p) => (
            <Renglon key={p.clave} etiqueta={etiquetaParte[p.clave]} valor={p.monto} />
          ))}
          {m.totalMes.operacion !== null && (
            <Text style={e.operacion}>
              {t.pdfCalculo}: {m.totalMes.operacion}
            </Text>
          )}
        </View>

        <View style={e.cifras} wrap={false}>
          <Cifra etiqueta={t.pdfComisionDelMes} valor={m.totales.comisionBruta} />
          <Cifra etiqueta={t.pdfComisionPagable} valor={m.totales.comisionPagable} />
          {m.totales.comisionBloqueada !== null && <Cifra etiqueta={t.pdfComisionBloqueada} valor={m.totales.comisionBloqueada} />}
          <Cifra etiqueta={t.pdfCaptacionParaMeta} valor={m.totales.captacionParaMeta} />
        </View>

        {/* Avance hacia el desbloqueo (80%) y hacia el 100% de la meta. */}
        {a !== null && (
          <View style={e.seccion} wrap={false}>
            <View style={e.estado}>
              <Text style={e.seccionTitulo}>{t.pdfTituloAvance}</Text>
              <Insignia si={a.desbloqueada} texto={a.desbloqueada ? t.pdfDesbloqueada : t.pdfBloqueada} />
            </View>
            <Svg width={anchoBarra} height={BARRA.alto + 4}>
              <Rect x={0} y={2} width={anchoBarra} height={BARRA.alto} rx={5} fill={COLOR.fondoMarino} stroke={COLOR.linea} strokeWidth={0.5} />
              <Rect x={0} y={2} width={Math.max(a.fraccion * anchoBarra, 0.5)} height={BARRA.alto} rx={5} fill={a.desbloqueada ? COLOR.verde : COLOR.gris} />
              {/* Marca del umbral de desbloqueo y de la meta (100%). */}
              <Line x1={a.fraccionUmbral * anchoBarra} y1={0} x2={a.fraccionUmbral * anchoBarra} y2={BARRA.alto + 4} stroke={COLOR.marino} strokeWidth={1.5} />
              <Line x1={anchoBarra - 0.75} y1={0} x2={anchoBarra - 0.75} y2={BARRA.alto + 4} stroke={COLOR.marino} strokeWidth={1.5} />
            </Svg>
            <View style={e.marcas}>
              <Text>{rellenar(t.pdfMarcaUmbral, { porcentaje: a.porcentajeUmbral, umbral: a.umbral })}</Text>
              <Text>{rellenar(t.pdfMarcaMeta, { meta: a.meta })}</Text>
            </View>
            <Text style={[e.textoFuerte, { marginTop: 2 }]}>
              {rellenar(t.pdfAvance, { porcentaje: a.porcentaje, captacion: m.totales.captacionParaMeta, meta: a.meta })}
            </Text>
            {a.fechaDesbloqueo !== null && <Text style={e.nota}>{rellenar(t.pdfDesbloqueadaEl, { fecha: a.fechaDesbloqueo })}</Text>}
            {a.faltaParaUmbral !== null && <Text style={e.nota}>{rellenar(t.pdfFaltaUmbral, { falta: a.faltaParaUmbral, umbral: a.umbral })}</Text>}
            <Text style={e.nota}>{a.faltaParaMeta === null ? t.pdfMetaCumplida : rellenar(t.pdfFaltaMeta, { falta: a.faltaParaMeta })}</Text>
            {m.notaBloqueo !== null && <Text style={e.nota}>{rellenar(t.pdfReglaCierre, { nota: m.notaBloqueo })}</Text>}
          </View>
        )}

        {/* Tabla por inversión: tasa completa (hasta 3 decimales) y comisión. */}
        <View style={e.seccion}>
          <Text style={e.seccionTitulo}>{t.pdfTituloTabla}</Text>
          <View style={e.encabezadoTabla} fixed>
            <Text style={[e.celda, { width: COL.numero }]}>{t.pdfColumnaNumero}</Text>
            <Text style={[e.celda, { width: COL.tipo }]}>{t.pdfColumnaTipo}</Text>
            <Text style={[e.celda, { width: COL.fecha }]}>{t.pdfColumnaFecha}</Text>
            <Text style={[e.celda, e.derecha, { width: COL.monto }]}>{t.pdfColumnaMonto}</Text>
            <Text style={[e.celda, e.separada, { width: COL.plazo }]}>{t.pdfColumnaPlazo}</Text>
            <Text style={[e.celda, e.derecha, { width: COL.tasa }]}>{t.pdfColumnaTasa}</Text>
            <Text style={[e.celda, e.derecha, { width: COL.comision }]}>{t.pdfColumnaComision}</Text>
            <Text style={[e.celda, e.separada, { width: COL.pago }]}>{t.pdfColumnaPago}</Text>
          </View>
          {m.lineas.map((l) => (
            <View key={l.numero} style={e.filaTabla} wrap={false}>
              <Text style={[e.celda, { width: COL.numero }]}>{l.numero}</Text>
              {/* Un solo renglón por inversión: la que no cuenta para la meta lleva la nota (1) debajo de la tabla. */}
              <Text style={[e.celda, { width: COL.tipo }]}>{l.cuentaParaMeta ? tipo(l.tipo) : `${tipo(l.tipo)} (1)`}</Text>
              <Text style={[e.celda, { width: COL.fecha }]}>{l.fecha}</Text>
              <Text style={[e.celda, e.derecha, { width: COL.monto }]}>{l.monto}</Text>
              <Text style={[e.celda, e.separada, { width: COL.plazo }]}>{l.plazo}</Text>
              <Text style={[e.celda, e.derecha, { width: COL.tasa }]}>{l.tasa}</Text>
              <Text style={[e.celda, e.derecha, e.textoFuerte, { width: COL.comision }]}>{l.comision}</Text>
              <Text style={[e.celda, e.separada, { width: COL.pago }]}>{l.fechaPago ?? t.pdfSinPago}</Text>
            </View>
          ))}
          {m.lineas.some((l) => !l.cuentaParaMeta) && <Text style={[e.nota, { marginTop: 2 }]}>(1) {t.pdfNoCuentaParaMeta}.</Text>}
        </View>

        {/* EJECUTIVO: metas y bonos con la fila alcanzada, sueldo base (propuesta) y bono. */}
        {m.incentivos?.tipo === "interno" && (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>{t.tituloMetas}</Text>
            <View style={e.encabezadoTabla}>
              <Text style={[e.celda, { width: 190 }]}>{t.columnaCumplimiento}</Text>
              <Text style={[e.celda, e.derecha, { width: 110 }]}>{t.columnaDesde}</Text>
              <Text style={[e.celda, e.derecha, { width: 110 }]}>{t.columnaHasta}</Text>
              <Text style={[e.celda, e.derecha, { width: 130 }]}>{t.columnaIncentivo}</Text>
            </View>
            {m.incentivos.filas.map((f) => (
              <View key={f.desde} style={[e.filaTabla, ...(f.alcanzada ? [e.alcanzada] : [])]}>
                <Text style={[e.celda, { width: 190 }]}>
                  {f.cumplimiento}
                  {f.alcanzada && <Text style={e.marcaAlcanzada}> · {t.filaAlcanzada}</Text>}
                </Text>
                <Text style={[e.celda, e.derecha, { width: 110 }]}>{f.desde}</Text>
                <Text style={[e.celda, e.derecha, { width: 110 }]}>{f.hasta ?? t.enAdelante}</Text>
                <Text style={[e.celda, e.derecha, { width: 130 }]}>{incentivo(f)}</Text>
              </View>
            ))}
            <View style={[e.dosColumnas, { marginTop: 4 }]}>
              <View style={e.columna}>
                {m.sueldoBase !== null && <Renglon etiqueta={t.sueldoBase} valor={m.sueldoBase} />}
                {m.bono !== null && <Renglon etiqueta={t.totalBono} valor={m.bono} />}
              </View>
              <View style={e.columna}>
                {m.incentivos.desbloqueo !== null && (
                  <Text style={e.nota}>
                    {rellenar(t.notaDesbloqueo, { porcentaje: m.incentivos.desbloqueo.porcentaje, umbral: m.incentivos.desbloqueo.umbral })}
                  </Text>
                )}
                <Text style={e.nota}>{t.pdfFechaIncentivos}</Text>
              </View>
            </View>
          </View>
        )}

        {/* GERENTE: su bono por captación sigue sin definir. */}
        {m.incentivos === null && (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>{t.totalBono}</Text>
            <Text style={e.nota}>{t.pdfSinBonoGerente}</Text>
            <Text style={e.nota}>{t.pdfFechaIncentivos}</Text>
          </View>
        )}

        {m.bonoGerente !== null && (
          <View style={e.seccion} wrap={false}>
            <Text style={e.seccionTitulo}>{t.pdfBonoGerente}</Text>
            <Text style={e.nota}>{t.pdfAyudaBonoGerente}</Text>
            <Renglon etiqueta={t.pdfBaseBonoGerente} valor={m.bonoGerente.base} />
            <Renglon etiqueta={t.pdfBonoGerente} valor={m.bonoGerente.bono} fuerte />
            <Text style={e.operacion}>
              {t.pdfCalculo}: {m.bonoGerente.operacion}
            </Text>
          </View>
        )}

        {m.redExterna !== null && (
          <View style={e.seccion} wrap={false}>
            <View style={e.estado}>
              <Text style={e.seccionTitulo}>{rellenar(t.comisionPorExternos, { porcentaje: m.redExterna.porcentaje })}</Text>
              <Insignia si={m.redExterna.desbloqueada} texto={m.redExterna.desbloqueada ? t.pdfDesbloqueada : t.pdfBloqueada} />
            </View>
            <Renglon etiqueta={t.basePorExternos} valor={m.redExterna.base} />
            <Renglon etiqueta={t.pdfComisionPagable} valor={m.redExterna.pagable} fuerte />
            <Renglon etiqueta={t.pdfComisionBloqueada} valor={m.redExterna.bloqueada} />
            <Text style={e.operacion}>
              {t.pdfCalculo}: {m.redExterna.operacion}
            </Text>
            <Text style={e.nota}>{rellenar(m.redExterna.desbloqueada ? t.redDesbloqueada : t.redBloqueada, { umbral: m.redExterna.umbral })}</Text>
            {m.redExterna.notaBloqueo !== null && <Text style={e.nota}>{rellenar(t.pdfReglaCierre, { nota: m.redExterna.notaBloqueo })}</Text>}
            <Text style={e.nota}>{t.notaAparte}</Text>
          </View>
        )}

        {/* Calendario de pagos por quincena. */}
        <View style={e.seccion} wrap={false}>
          <Text style={e.seccionTitulo}>{t.pdfTituloCalendario}</Text>
          <Text style={e.nota}>
            {rellenar(t.pdfReglaQuincenas, {
              dia_corte: String(r.ultimoDiaQuincena1),
              dia_pago: String(r.diaPagoQuincena1),
              dia_siguiente: String(r.ultimoDiaQuincena1 + 1),
              dia_pago_siguiente: String(r.diaPagoQuincena2),
            })}
          </Text>
          <Text style={e.nota}>
            {rellenar(t.pdfReglaInterno, { dia_corte: String(r.ultimoDiaQuincena1), dia_pago_siguiente: String(r.diaPagoQuincena2) })}
          </Text>
          {m.pagos.length === 0 ? (
            <Text style={[e.textoFuerte, { marginTop: 2 }]}>{t.pdfSinPagos}</Text>
          ) : (
            m.pagos.map((p) => (
              <View key={p.fecha} style={[e.parte, { marginTop: 2 }]}>
                <Text style={e.textoFuerte}>{p.fecha}</Text>
                <Text>
                  {p.inversiones.length === 1
                    ? rellenar(t.pdfPagoInversion, { n: String(p.inversiones[0]) })
                    : rellenar(t.pdfPagoInversiones, { lista: lista(p.inversiones) })}
                </Text>
                <Text style={e.textoFuerte}>{p.monto}</Text>
              </View>
            ))
          )}
        </View>

        <View style={e.avisos} wrap={false}>
          <Text>{t.avisoPdf}</Text>
        </View>
      </Page>
    </Document>
  );
}
