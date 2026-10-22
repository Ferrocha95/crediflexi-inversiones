import { describe, expect, it } from "vitest";
import { esHostLocal, esHostPermitido, leerHostsPermitidos } from "../../../src/aplicacion/host";

describe("esHostLocal: acepta", () => {
  it.each([
    "localhost",
    "localhost:3000",
    "LOCALHOST:3000",
    "127.0.0.1",
    "127.0.0.1:3000",
    "[::1]",
    "[::1]:3000",
    "localhost:1",
    "localhost:65535",
  ])("%j", (host) => {
    expect(esHostLocal(host)).toBe(true);
  });
});

describe("esHostLocal: rechaza", () => {
  it.each([
    ["nulo", null],
    ["indefinido", undefined],
    ["vacío", ""],
    ["dominio público", "crediflexi.example.com"],
    ["IP de la red local", "192.168.1.10:3000"],
    ["todas las interfaces", "0.0.0.0:3000"],
    ["otra IP de loopback", "127.0.0.2"],
    ["subdominio que empieza con localhost", "localhost.example.com"],
    ["localhost con punto final", "localhost."],
    ["IP local dentro de otro dominio", "127.0.0.1.nip.io"],
    ["IPv6 sin corchetes", "::1"],
    ["puerto vacío", "localhost:"],
    ["puerto 0", "localhost:0"],
    ["puerto fuera de rango", "localhost:65536"],
    ["puerto con letras", "localhost:30a0"],
    ["usuario antes del host", "usuario@localhost"],
    ["espacios", " localhost "],
    ["dos hosts", "localhost,evil.example.com"],
  ])("%s (%j)", (_, host) => {
    expect(esHostLocal(host)).toBe(false);
  });
});

describe("leerHostsPermitidos", () => {
  it("sin la variable devuelve null: solo los hosts locales, como antes", () => {
    expect(leerHostsPermitidos(undefined)).toBeNull();
  });

  it("separa por comas, quita espacios alrededor y pasa a minúsculas", () => {
    expect(leerHostsPermitidos(" App-Prueba.Vercel.app , 127.0.0.1:3000,[::1]:8080 ")).toEqual([
      "app-prueba.vercel.app",
      "127.0.0.1:3000",
      "[::1]:8080",
    ]);
  });

  it("un solo host también es una lista", () => {
    expect(leerHostsPermitidos("crediflexi-prueba.vercel.app")).toEqual(["crediflexi-prueba.vercel.app"]);
  });

  it.each([
    ["vacía", ""],
    ["solo espacios", "   "],
    ["entrada vacía entre comas", "a.example.com,,b.example.com"],
    ["coma al final", "a.example.com,"],
    ["comodín", "*.vercel.app"],
    ["comodín suelto", "*"],
    ["usuario con @", "usuario@app.example.com"],
    ["ruta", "app.example.com/acceso"],
    ["esquema", "https://app.example.com"],
    ["espacio interno", "app example.com"],
    ["puerto vacío", "app.example.com:"],
    ["puerto 0", "app.example.com:0"],
    ["puerto fuera de rango", "app.example.com:65536"],
    ["puerto con letras", "app.example.com:80a"],
    ["punto final", "app.example.com."],
    ["dos puntos seguidos", "app..example.com"],
    ["guion al inicio de una etiqueta", "-app.example.com"],
    ["guion al final de una etiqueta", "app-.example.com"],
    ["IPv6 sin corchetes", "::1"],
    ["consulta", "app.example.com?x=1"],
    ["barra invertida", "app.example.com\\x"],
    ["salto de línea", "app.example.com\nevil.example.com"],
  ])("lista mal formada (%s): lanza un error en español sin repetir el valor", (_, valor) => {
    let mensaje = "";
    try {
      leerHostsPermitidos(valor);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toMatch(/^HOSTS_PERMITIDOS/);
    expect(mensaje).toMatch(/Corrígela/);
    for (const parte of valor.split(/[,\s]+/).filter((p) => p.length > 3)) expect(mensaje).not.toContain(parte);
  });

  it("el error dice qué entrada falló, por su número", () => {
    expect(() => leerHostsPermitidos("a.example.com,b.example.com,*.example.com")).toThrow(/entrada 3/);
  });
});

describe("esHostPermitido", () => {
  it("con lista null se comporta como esHostLocal", () => {
    for (const host of ["localhost:3000", "127.0.0.1", "[::1]:3000"]) expect(esHostPermitido(host, null)).toBe(true);
    for (const host of ["app.example.com", "localhost.evil.com", null, ""]) expect(esHostPermitido(host, null)).toBe(false);
  });

  const lista = ["app-prueba.vercel.app", "127.0.0.1:3000"];

  it.each(["app-prueba.vercel.app", "APP-PRUEBA.Vercel.App", "127.0.0.1:3000"])("acepta exacto, sin distinguir mayúsculas: %j", (host) => {
    expect(esHostPermitido(host, lista)).toBe(true);
  });

  it.each([
    ["la lista reemplaza a los locales", "localhost:3000"],
    ["el mismo host con otro puerto", "127.0.0.1:3100"],
    ["el host sin el puerto de la lista", "127.0.0.1"],
    ["el host de la lista con un puerto que no está", "app-prueba.vercel.app:443"],
    ["subdominio", "x.app-prueba.vercel.app"],
    ["sufijo", "app-prueba.vercel.app.evil.com"],
    ["prefijo", "evil-app-prueba.vercel.app"],
    ["localhost.evil.com", "localhost.evil.com"],
    ["usuario con @", "usuario@app-prueba.vercel.app"],
    ["con ruta", "app-prueba.vercel.app/acceso"],
    ["espacios", " app-prueba.vercel.app "],
    ["dos hosts", "app-prueba.vercel.app,evil.com"],
    ["nulo", null],
    ["vacío", ""],
  ])("rechaza (%s): %j", (_, host) => {
    expect(esHostPermitido(host, lista)).toBe(false);
  });
});
