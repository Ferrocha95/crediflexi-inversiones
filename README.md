# Crediflexi · Sistema interno de captación e inversiones

Mesa de trabajo interna para cotizar inversiones (Crediflexi / Rami Sise).
La especificación está en `BLUEPRINT.md` y las reglas de trabajo en `CLAUDE.md`.

## Versión solo local: no desplegar

Esta versión es **solo local**: no tiene login ni base de datos para la app.
**No se debe desplegar** en ningún servidor ni exponer a la red.

- `npm run dev` y `npm run start` escuchan solo en `127.0.0.1`.
- La app rechaza (403) cualquier petición cuyo encabezado `Host` no sea
  `localhost`, `127.0.0.1` o `[::1]`. Es un seguro contra un despliegue por
  accidente, no seguridad real.
- Usa solo datos sintéticos. Nada de lo que se escribe en el cotizador se guarda.

## Requisitos

- Node 24 y npm.
- Para las pruebas `rls`: Docker y la CLI de Supabase (viene en las dependencias de desarrollo).

## Correr la app

```sh
npm install
npm run dev          # desarrollo: http://127.0.0.1:3000/cotizador
```

Versión compilada:

```sh
npm run build
npm run start        # http://127.0.0.1:3000/cotizador
npm run start -- -p 3100   # en otro puerto
```

## Pruebas

```sh
npm run test:unit    # unitarias, pruebas de oro y PDF real (no necesitan base de datos)
npm run typecheck
npm run lint
```

Las pruebas `rls` necesitan **Supabase local** corriendo:

```sh
npm run db:start     # levanta Supabase local (Docker)
npm run test:rls
npm run db:stop
```

`npm test` corre las dos (unitarias y rls), así que también necesita Supabase local.

## Parámetros y textos

- `seed/parametros_iniciales.json`: tasas, reglas y entidades (versionado).
- `seed/textos_cotizacion.json`: textos de la pantalla y del PDF.

Se leen en cada petición: un cambio en esos archivos se ve sin reconstruir la app.

## Fuente del PDF

Nunito, con la SIL Open Font License 1.1 (`src/servidor/pdf/LICENCIA-Nunito-OFL.txt`),
instalada con `@fontsource/nunito`.
