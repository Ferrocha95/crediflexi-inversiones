// Generador de contraseñas sintéticas para las pruebas (RLS y e2e) y los
// scripts locales. Cumple la regla de supabase/config.toml: 12 caracteres como
// mínimo y, garantizadas, una minúscula, una mayúscula y un dígito. Usa
// crypto.randomInt (sin sesgo) y baraja el resultado.

import { randomInt } from "node:crypto";

export const LARGO_CONTRASENA = 24;
const LARGO_MINIMO = 12;

const MINUSCULAS = "abcdefghijklmnopqrstuvwxyz";
const MAYUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITOS = "0123456789";
const TODOS = MINUSCULAS + MAYUSCULAS + DIGITOS;

const uno = (alfabeto) => alfabeto[randomInt(alfabeto.length)];

/** Contraseña aleatoria de `largo` caracteres (24 por omisión, 12 como mínimo). */
export function generarContrasena(largo = LARGO_CONTRASENA) {
  if (!Number.isInteger(largo) || largo < LARGO_MINIMO) {
    throw new Error(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`);
  }
  const letras = [uno(MINUSCULAS), uno(MAYUSCULAS), uno(DIGITOS)];
  while (letras.length < largo) letras.push(uno(TODOS));
  // Fisher-Yates, para que las tres garantizadas no queden siempre al principio.
  for (let i = letras.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join("");
}
