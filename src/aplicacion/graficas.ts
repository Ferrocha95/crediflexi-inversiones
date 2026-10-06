// Escalas, marcas de los ejes y trazados de las gráficas del PDF. Funciones
// puras sobre números: aquí solo se calculan coordenadas para dibujar; las
// cifras que se leen salen del dominio como texto decimal.

/** Lleva [d0, d1] a [r0, r1]. Un dominio de amplitud cero cae en el centro del rango. */
export function escalaLineal(
  dominio: readonly [number, number],
  rango: readonly [number, number],
): (v: number) => number {
  const [d0, d1] = dominio;
  const [r0, r1] = rango;
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** Paso "redondo" (1, 2 o 5 por una potencia de 10) más cercano a `bruto`. */
function pasoRedondo(bruto: number): number {
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / potencia;
  const m = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return m * potencia;
}

/** Siguiente paso redondo mayor: 1 → 2 → 5 → 10. */
function siguientePaso(paso: number): number {
  const potencia = 10 ** Math.floor(Math.log10(paso) + 1e-9);
  const m = Math.round(paso / potencia);
  return (m === 1 ? 2 : m === 2 ? 5 : 10) * potencia;
}

/**
 * Marcas del eje de valores: pasos redondos, de un múltiplo del paso igual o
 * menor que `min` a uno igual o mayor que `max`, con unas `cuantas` marcas (8
 * como máximo). Si el rango es cero, se abre lo necesario para que haya eje.
 */
export function marcasValor(min: number, max: number, cuantas = 5): number[] {
  if (max === min) {
    if (max === 0) return [0, 1];
    const holgura = Math.abs(max) / 10;
    return marcasValor(min - holgura, max + holgura, cuantas);
  }
  let paso = pasoRedondo((max - min) / (cuantas - 1));
  for (;;) {
    const inicio = Math.floor(min / paso);
    const fin = Math.ceil(max / paso);
    if (fin - inicio + 1 <= 8) {
      return Array.from({ length: fin - inicio + 1 }, (_, i) => (inicio + i) * paso);
    }
    paso = siguientePaso(paso);
  }
}

const PASOS_MESES = [1, 2, 3, 6, 12] as const;

/**
 * Marcas del eje de meses, de 0 al total: el paso más chico (1, 2, 3, 6 o 12)
 * que deja como máximo `intervalos` intervalos. Si el total no es múltiplo del
 * paso, la última marca es el total y se quita la anterior si queda pegada.
 */
export function marcasMeses(totalMeses: number, intervalos = 8): number[] {
  const paso = PASOS_MESES.find((p) => totalMeses / p <= intervalos) ?? Math.ceil(totalMeses / intervalos);
  const marcas: number[] = [];
  for (let m = 0; m <= totalMeses; m += paso) marcas.push(m);
  if (marcas.at(-1) !== totalMeses) {
    if (totalMeses - marcas.at(-1)! < paso / 2) marcas.pop();
    marcas.push(totalMeses);
  }
  return marcas;
}

/** Ruta SVG que une los puntos con líneas rectas ("M x y L x y ..."). */
export function trazado(puntos: readonly { readonly x: number; readonly y: number }[]): string {
  return puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/**
 * Posiciones verticales de etiquetas para que no se encimen: si dos quedan a
 * menos de `separacion`, se separan, sin salir de `limites`. Devuelve las
 * posiciones en el mismo orden en que se recibieron.
 */
export function separarEtiquetas(
  ys: readonly number[],
  separacion: number,
  limites: readonly [number, number],
): number[] {
  const [minimo, maximo] = limites;
  const orden = ys.map((y, i) => ({ y: Math.min(Math.max(y, minimo), maximo), i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < orden.length; k++) {
    orden[k].y = Math.max(orden[k].y, orden[k - 1].y + separacion);
  }
  const exceso = orden.length > 0 ? orden[orden.length - 1].y - maximo : 0;
  if (exceso > 0) for (const o of orden) o.y = Math.max(minimo, o.y - exceso);
  const resultado = new Array<number>(ys.length);
  for (const o of orden) resultado[o.i] = o.y;
  return resultado;
}
