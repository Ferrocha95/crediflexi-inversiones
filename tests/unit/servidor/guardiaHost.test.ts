import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../../../src/proxy";
import { MENSAJE_HOST_NO_LOCAL, rechazoPorHost } from "../../../src/servidor/guardiaHost";

describe("rechazoPorHost", () => {
  it("con un Host público devuelve 403 con el mensaje en español", async () => {
    const r = rechazoPorHost("ejemplo.com");
    expect(r).not.toBeNull();
    expect(r!.status).toBe(403);
    expect(r!.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(r!.headers.get("cache-control")).toBe("no-store");
    expect(await r!.text()).toBe(MENSAJE_HOST_NO_LOCAL);
  });

  it.each(["192.168.1.10:3000", "0.0.0.0:3000", "localhost.example.com", ""])("rechaza %j", (host) => {
    expect(rechazoPorHost(host)?.status).toBe(403);
  });

  it("sin encabezado Host también rechaza", () => {
    expect(rechazoPorHost(null)?.status).toBe(403);
  });

  it.each(["localhost:3000", "127.0.0.1:3100", "[::1]:3000", "localhost"])("deja pasar %j", (host) => {
    expect(rechazoPorHost(host)).toBeNull();
  });

  it("el mensaje dice qué pasó y qué hacer, y aclara que no es seguridad", () => {
    expect(MENSAJE_HOST_NO_LOCAL).toMatch(/solo/);
    expect(MENSAJE_HOST_NO_LOCAL).toMatch(/localhost/);
  });
});

describe("proxy", () => {
  it("con Host: ejemplo.com responde 403 en /cotizador", async () => {
    const r = proxy(new NextRequest("http://ejemplo.com/cotizador", { headers: { host: "ejemplo.com" } }));
    expect(r.status).toBe(403);
    expect(await r.text()).toBe(MENSAJE_HOST_NO_LOCAL);
  });

  it("también responde 403 a un POST (como el de una acción del servidor)", () => {
    const r = proxy(
      new NextRequest("http://ejemplo.com/cotizador", {
        method: "POST",
        headers: { host: "ejemplo.com", "next-action": "x" },
        body: "[]",
      }),
    );
    expect(r.status).toBe(403);
  });

  it("con localhost deja seguir la petición", () => {
    const r = proxy(new NextRequest("http://localhost:3000/cotizador", { headers: { host: "localhost:3000" } }));
    expect(r.status).toBe(200);
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });
});
