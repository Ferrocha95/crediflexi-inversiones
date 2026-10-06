import { describe, expect, it } from "vitest";
import { MENSAJES_ACCESO, mensajeDeErrorAuth } from "../../../src/aplicacion/acceso/mensajes";

describe("mensajeDeErrorAuth: errores de Auth a mensajes en español", () => {
  it("los textos son los acordados", () => {
    expect(MENSAJES_ACCESO.credenciales).toBe("Correo o contraseña incorrectos.");
    expect(MENSAJES_ACCESO.inactivo).toBe("Tu usuario está inactivo; habla con tu gerente.");
    expect(MENSAJES_ACCESO.demasiadosIntentos).toBe("Demasiados intentos; espera unos minutos.");
  });

  it.each([
    { code: "invalid_credentials", status: 400 },
    { code: "user_not_found", status: 400 },
    { code: "email_not_confirmed", status: 400 },
    { code: "email_address_invalid", status: 400 },
    { code: "validation_failed", status: 400 },
    { code: undefined, status: 400 },
  ])("$code ($status) da el mensaje genérico de credenciales, sin decir si el correo existe", (error) => {
    expect(mensajeDeErrorAuth(error)).toBe(MENSAJES_ACCESO.credenciales);
  });

  it.each([
    { code: "over_request_rate_limit", status: 429 },
    { code: "over_email_send_rate_limit", status: 429 },
    { code: undefined, status: 429 },
  ])("$code ($status) pide esperar", (error) => {
    expect(mensajeDeErrorAuth(error)).toBe(MENSAJES_ACCESO.demasiadosIntentos);
  });

  it("un usuario bloqueado en Auth recibe el mensaje de inactivo", () => {
    expect(mensajeDeErrorAuth({ code: "user_banned", status: 400 })).toBe(MENSAJES_ACCESO.inactivo);
  });

  it.each([
    { code: undefined, status: 0 },
    { code: undefined, status: 500 },
    { code: "unexpected_failure", status: 500 },
    { code: "request_timeout", status: 504 },
  ])("si el servicio de acceso falla ($status) lo dice y no culpa a la contraseña", (error) => {
    const m = mensajeDeErrorAuth(error);
    expect(m).toBe(MENSAJES_ACCESO.sinServicio);
    expect(m).not.toMatch(/contraseña/);
  });

  it("ningún mensaje menciona si el correo existe o está registrado", () => {
    for (const m of Object.values(MENSAJES_ACCESO)) {
      expect(m).not.toMatch(/no existe|registrad|no encontr/i);
    }
  });
});
