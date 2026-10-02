import type {
  DatosEnvioViernes,
  DatosMeta,
  DatosPipelineEstatus,
  DatosPlanHoy,
  DatosProyeccionSemana,
  DatosSeguimientos,
} from "../../componentes/inicio/TarjetasResumen";
import type { DiaPlan } from "../../componentes/vistas/CuadriculaSemanal";
import type { FilaPipelineDatos } from "../../componentes/vistas/TablaPipeline";
import type { FilaProyeccion } from "../../componentes/vistas/TablaProyeccion";

/*
 * DATOS DE EJEMPLO, SINTÉTICOS. Ninguno corresponde a una persona real: los
 * nombres dicen "Ejemplo" y los teléfonos son 55 0000 00XX. Las cifras son
 * texto fijo: aquí no se calcula nada (el total de la proyección se escribió a
 * mano para que cuadre con las cantidades).
 */

export const PIPELINE_EJEMPLO: readonly FilaPipelineDatos[] = [
  {
    id: "p1",
    nombre: "Prospecto Ejemplo Uno",
    contacto: "55 0000 0001",
    comentarios: "Pidió la cotización a 12 meses y quiere comparar con su banco. Llamar el martes por la tarde.",
    estatus: "INTERESADO",
    seguimiento: "6/10/2026",
    ejecutivo: "Ejecutivo Ejemplo A",
  },
  {
    id: "p2",
    nombre: "Prospecta Ejemplo Dos",
    contacto: "55 0000 0002",
    comentarios: "Contesta a veces. Prefiere mensajes por la mañana.",
    estatus: "INTERMITENTE",
    seguimiento: "8/10/2026",
    ejecutivo: "Ejecutivo Ejemplo B",
  },
  {
    id: "p3",
    nombre: "Prospecto Ejemplo Tres",
    contacto: "55 0000 0003",
    comentarios: "Por ahora no busca invertir. Volver a contactar el próximo trimestre.",
    estatus: "NO INTERESADO",
    seguimiento: "15/1/2027",
    ejecutivo: "Ejecutivo Ejemplo A",
  },
];

export const SEMANA_EJEMPLO: readonly DiaPlan[] = [
  {
    clave: "lun",
    nombre: "Lunes",
    fecha: "5/10/2026",
    bloques: {
      "9:00": { donde: "Sucursal", que: "Gestión cartera" },
      "10:00": { donde: "Sucursal", que: "Llamadas" },
      "12:00": { donde: "Campo", que: "Carta invitación" },
      "14:00": { donde: "Comida", que: "Comida" },
      "16:00": { donde: "Sucursal", que: "Cita con Prospecto Ejemplo Uno" },
    },
  },
  {
    clave: "mar",
    nombre: "Martes",
    fecha: "6/10/2026",
    bloques: {
      "9:00": { donde: "Sucursal", que: "Llamadas" },
      "11:00": { donde: "Campo", que: "Carta invitación" },
      "14:00": { donde: "Comida", que: "Comida" },
    },
  },
  {
    clave: "mie",
    nombre: "Miércoles",
    fecha: "7/10/2026",
    bloques: {
      "10:00": { donde: "Sucursal", que: "Gestión cartera" },
      "13:00": { donde: "Comida", que: "Cita con Prospecta Ejemplo Dos" },
    },
  },
  {
    clave: "jue",
    nombre: "Jueves",
    fecha: "8/10/2026",
    bloques: {
      "9:00": { donde: "Campo", que: "Carta invitación" },
      "15:00": { donde: "Sucursal", que: "Llamadas" },
    },
  },
  {
    clave: "vie",
    nombre: "Viernes",
    fecha: "9/10/2026",
    bloques: {
      "9:00": { donde: "Sucursal", que: "Gestión cartera" },
      "17:00": { donde: "Sucursal", que: "Llamadas" },
    },
  },
];

export const PROYECCION_EJEMPLO: readonly FilaProyeccion[] = [
  { id: "y1", fecha: "5/10/2026", ejecutivo: "Ejecutivo Ejemplo A", cantidad: "$250,000.00", cierre: "80%", inversionista: "Prospecto Ejemplo Uno" },
  { id: "y2", fecha: "7/10/2026", ejecutivo: "Ejecutivo Ejemplo B", cantidad: "$100,000.00", cierre: "50%", inversionista: "Prospecta Ejemplo Dos" },
  { id: "y3", fecha: "8/10/2026", ejecutivo: "Ejecutivo Ejemplo A", cantidad: "$500,000.00", cierre: "30%", inversionista: "Prospecto Ejemplo Cuatro" },
  { id: "y4", fecha: "9/10/2026", ejecutivo: "Ejecutivo Ejemplo B", cantidad: "$75,000.00", cierre: "90%", inversionista: "Prospecta Ejemplo Cinco" },
];

/** Suma de las cuatro cantidades de arriba, escrita a mano. */
export const TOTAL_PROYECCION_EJEMPLO = "$925,000.00";

/** Cifras para ver el número animado: se recorren al pulsar el botón. */
export const CIFRAS_EJEMPLO = ["$12,480.50", "$13,915.25", "$9,302.00", "$128,760.75"] as const;

// Tarjetas de resumen del inicio (solo aquí: la página / no recibe datos).

/** 1,550,000 de 2,500,000 = 62 %: la fracción y los textos se escribieron a mano para que cuadren. */
export const META_EJEMPLO: DatosMeta = {
  fraccion: 0.62,
  porcentaje: "62%",
  logrado: "$1,550,000.00",
  meta: "$2,500,000.00",
};

export const PIPELINE_ESTATUS_EJEMPLO: DatosPipelineEstatus = {
  conteos: { INTERESADO: 7, INTERMITENTE: 6, "NO INTERESADO": 4 },
};

export const SEGUIMIENTOS_EJEMPLO: DatosSeguimientos = {
  filas: [
    { id: "s1", nombre: "Prospecto Ejemplo Uno", estatus: "INTERESADO", nota: "Llamar por la tarde para cerrar el plazo." },
    { id: "s2", nombre: "Prospecta Ejemplo Dos", estatus: "INTERMITENTE", nota: "Mandar mensaje por la mañana." },
  ],
};

export const PROYECCION_SEMANA_EJEMPLO: DatosProyeccionSemana = {
  total: TOTAL_PROYECCION_EJEMPLO,
  detalle: "4 inversionistas",
  semana: "Del 5 al 9 de octubre",
};

export const PLAN_HOY_EJEMPLO: DatosPlanHoy = {
  bloques: [
    { hora: "9:00", donde: "Sucursal", que: "Gestión cartera" },
    { hora: "12:00", donde: "Campo", que: "Carta invitación" },
    { hora: "16:00", donde: "Sucursal", que: "Cita con Prospecto Ejemplo Uno" },
  ],
};

export const ENVIO_EJEMPLO: DatosEnvioViernes = {
  fecha: "Viernes 9 de octubre",
  archivos: [
    { nombre: "PIPELINE_OCTUBRE.xlsx", listo: true },
    { nombre: "PLAN_Y_PROYECCION_SEMANAL_DEL_12_AL_16_DE_OCTUBRE_DEL_2026.xlsx", listo: false },
  ],
};
