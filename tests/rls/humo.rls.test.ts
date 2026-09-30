import { describe, expect, inject, it } from "vitest";
import { comoUsuario } from "./clientes";

describe("RLS humo", () => {
  it("E1 solo ve su propia fila en usuarios", async () => {
    const { idsUsuarios } = inject("rls");
    const e1 = await comoUsuario("E1");

    const { data, error } = await e1.from("usuarios").select("id");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: idsUsuarios.E1 }]);
  });
});
