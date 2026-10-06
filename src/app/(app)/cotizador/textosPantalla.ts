/**
 * Textos fijos de la pantalla del cotizador, en español de México. Los textos
 * de negocio (etiquetas de las cifras, estatus, monedas, esquemas, errores del
 * dominio) no viven aquí: llegan del servidor.
 */
export const TEXTOS = {
  tituloPagina: "Cotizador de inversiones",
  introduccion: "Calcula una cotización con las tasas vigentes. Nada de lo que escribes aquí se guarda.",
  avisoLocal: "Versión solo local: sin login y sin base de datos.",
  volverInicio: "Volver al inicio",

  tituloFormulario: "Datos de la cotización",
  entidad: "Entidad",
  moneda: "Moneda",
  esquema: "Esquema",
  monto: "Monto",
  ayudaMonto: "Ejemplo: 150,000.50 o 150000.50",
  plazo: "Plazo",
  eligePlazoOpcion: "Elige un plazo",
  plazoSinMonto: "Escribe primero el monto",

  tituloVistaPrevia: "Vista previa",
  escribeMonto: "Escribe el monto para ver los plazos disponibles y la vista previa.",
  calculando: "Calculando la vista previa…",
  eligePlazo: "Elige un plazo para ver la vista previa.",
  tituloError: "No se pudo calcular la cotización",
  errorConexion:
    "No se pudo comunicar con el servidor. Revisa que la app siga corriendo y vuelve a intentarlo.",

  tasaAnual: "Tasa anual",
  tramoAplicado: "Tramo aplicado",
  estatusTasa: "Estatus de la tasa",
  sinEstatus: "Sin estatus en la tabla",
  origenPlazoAdicional: "La tasa sale del plazo adicional de la tabla; el estatus es el del tramo del monto.",
  tituloCifras: "Resultados",
  formula: "Fórmula",
  operacion: "Operación",
  tituloAvisos: "Aviso",
  versionTasas: (version: string, fecha: string) => `Tasas versión ${version} del ${fecha}.`,

  tituloConfirmacion: "Confirmación",
  confirmo: "Confirmo que los números son correctos",
  generarPdf: "Generar PDF",
  motivoSinVistaPrevia: "El PDF se habilita cuando haya una vista previa válida.",
  motivoVistaPreviaVieja: "La vista previa no corresponde a los datos actuales; espera a que se actualice.",
  motivoSinConfirmar: 'Marca la casilla "Confirmo que los números son correctos" para habilitar el PDF.',

  tituloOpcionales: "Datos opcionales del PDF",
  ayudaOpcionales: "No cambian los números: solo se imprimen en el PDF. No se guardan.",
  preparadoPara: "Preparado para",
  ejecutivo: "Ejecutivo (nombre y contacto)",
  vigencia: "Vigencia",
  notaAdicional: "Nota adicional",
  contador: (n: number, tope: number) => `${n} de ${tope} caracteres`,
  generandoPdf: "Generando el PDF…",
  pdfListo: "Listo: el PDF se descargó.",
  tituloErrorPdf: "No se pudo generar el PDF",
  errorPdfGenerico: (estado: number) =>
    `El servidor no pudo generar el PDF (código ${estado}). Vuelve a intentarlo; si sigue fallando, reinicia la app.`,
  nombrePdfPorOmision: "cotizacion.pdf",

  tituloErrorParametros: "No se pudieron cargar los parámetros del cotizador",
  ayudaErrorParametros: "Corrige el archivo indicado y vuelve a cargar la página.",
} as const;
