import { describe, expect, it } from "vitest";
import { esHostLocal } from "../../../src/aplicacion/host";

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
