import { describe, expect, it } from "vitest";
import { siguienteSeguro } from "../../../src/aplicacion/acceso/siguiente";

describe("siguienteSeguro: solo acepta rutas relativas y locales", () => {
  it.each(["/", "/cotizador", "/cotizador?monto=50000&plazo=12", "/diseno#tarjetas", "/a/b/c"])("acepta %j", (ruta) => {
    expect(siguienteSeguro(ruta)).toBe(ruta);
  });

  it.each([
    "//evil.example",
    "//evil.example/cotizador",
    "/\\evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "http://127.0.0.1:3000/cotizador",
    "javascript:alert(1)",
    "cotizador",
    "./cotizador",
    "../cotizador",
    "",
    " /cotizador",
    "/cotizador\n",
    "/coti\tzador",
    "/%2F%2Fevil.example",
  ])("rechaza %j y devuelve el inicio", (ruta) => {
    expect(siguienteSeguro(ruta)).toBe("/");
  });

  it.each([null, undefined, 42, ["/cotizador"], { ruta: "/cotizador" }])("con un valor que no es texto (%j) devuelve el inicio", (valor) => {
    expect(siguienteSeguro(valor)).toBe("/");
  });

  it.each(["/acceso", "/acceso?siguiente=/cotizador", "/acceso/salir"])("no regresa a la pantalla de acceso (%j)", (ruta) => {
    expect(siguienteSeguro(ruta)).toBe("/");
  });

  it("rechaza un texto demasiado largo", () => {
    expect(siguienteSeguro(`/${"a".repeat(2100)}`)).toBe("/");
  });
});
