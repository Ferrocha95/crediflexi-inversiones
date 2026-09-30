# CLAUDE.md — Sistema interno de captación e inversiones (Crediflexi / Rami Sise)

Mesa de trabajo interna para 3–4 personas: cotizar inversiones, dar seguimiento al alta de clientes, ver comisiones y metas, llevar pipeline y red de externos.
La especificación completa está en `BLUEPRINT.md`; los parámetros iniciales en `seed/parametros_iniciales.json`.

## Reglas de trabajo

1. Lee `BLUEPRINT.md` y `seed/parametros_iniciales.json` antes de escribir código.
2. **No inventes reglas.** Si algo está en ❓ o ⛔, constrúyelo como parámetro editable y pregunta.
3. Dinero con `decimal.js` y `numeric`. Nunca `number` para montos o tasas.
4. Ninguna tasa, porcentaje o umbral vive en el código: todo sale de parámetros versionados.
5. Escribe primero la prueba de oro y luego la función.
6. Nunca uses, pegues ni generes datos personales reales. Solo sintéticos.
7. Cada pantalla que calcula dinero muestra el desglose.
8. Todo cambio de parámetro pasa por la bitácora.
9. Mensajes de error en español claro: qué falló y qué hacer.
10. Antes de declarar una fase terminada, corre todas las pruebas de oro y reporta cuáles pasan.

## Alcance vigente

Si `BLUEPRINT.md` contradice esta sección, **manda CLAUDE.md**.

- No hay integración con HubSpot.
- La app **NO** guarda datos sensibles: nada de RFC, CURP, CLABE, cuentas, tarjetas, INE, documentos de identidad ni estados de cuenta. Solo datos básicos de cliente (nombre, teléfono, correo).
- El módulo de alta es solo un checklist de estados y fechas, sin archivos ni datos de identidad.
- No hay exportación a YUNIUS.
- Los externos solo tienen nombre, contacto, nivel y producción.
- Desarrollo y pruebas con datos sintéticos. Los datos reales básicos solo entran en producción, con autorización de la gerente.

@AGENTS.md
