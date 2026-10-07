# Crediflexi · Sistema interno de captación e inversiones

Mesa de trabajo interna para cotizar inversiones (Crediflexi / Rami Sise).
La especificación está en `BLUEPRINT.md` y las reglas de trabajo en `CLAUDE.md`.

## Versión solo local: no desplegar

Esta versión es **solo local**: inicia sesión contra **Supabase local** (Docker)
y no tiene segundo factor. **No se debe desplegar** en ningún servidor ni
exponer a la red.

- `npm run dev` y `npm run start` escuchan solo en `127.0.0.1`.
- La app rechaza (403) cualquier petición cuyo encabezado `Host` no sea
  `localhost`, `127.0.0.1` o `[::1]`. Es un seguro contra un despliegue por
  accidente, no seguridad real.
- Usa solo datos sintéticos. Nada de lo que se escribe en el cotizador se guarda.

## Requisitos

- Node 24 y npm.
- Docker y la CLI de Supabase (viene en las dependencias de desarrollo): la app
  y las pruebas `rls` y e2e necesitan Supabase local.

## Correr la app

```sh
npm install
npm run db:start     # levanta Supabase local (Docker)
npm run dev          # desarrollo: http://127.0.0.1:3000/acceso
```

`npm run dev` y `npm run start` pasan por `scripts/con-entorno.mjs`: toma la URL
y la llave publicable de `supabase status`, se niega si la URL no es local y
arranca Next con esas dos variables solo en memoria. No hay archivos `.env` y
el navegador nunca habla con Supabase.

Versión compilada:

```sh
npm run build
npm run start        # http://127.0.0.1:3000/acceso
npm run start -- -p 3100   # en otro puerto
```

## Iniciar sesión

El registro público está cerrado (`supabase/config.toml`): los usuarios los crea
el script de usuarios sintéticos, con la llave de servicio solo en memoria. Las
contraseñas son aleatorias (12 caracteres o más, con minúscula, mayúscula y
dígito) y **se muestran una sola vez**: cópialas al crearlas.

```sh
npm run usuarios:sinteticos
# Organización Sintética: 2 sucursales, director, gerente, 2 ejecutivos (@ejemplo.test) y 8 prospectos

npm run usuarios:sinteticos -- --correo fer.rocha@crediflexi.test --nombre "Fernando Rocha" --rol EJECUTIVO --sucursal Metepec
# un usuario nombrado en la organización "Crediflexi" (la crea si no existe) y la sucursal indicada
```

Si los datos ya existen, el script se niega: para empezar de cero,
`npm run db:reset` (borra **todos** los datos de la base local) y vuelve a
correrlo. Roles válidos: `DIRECTOR_REGIONAL`, `GERENTE` y `EJECUTIVO`.

Entra en `http://127.0.0.1:3000/acceso` con el correo y la contraseña. El menú
muestra tu nombre, rol y sucursal, y el botón **Cerrar sesión**. Si la sesión
expira mientras usas el cotizador, la pantalla lo avisa con un enlace para
volver a entrar. Un usuario desactivado pierde el acceso en su siguiente
petición.

Después de cambiar `supabase/config.toml`, reinicia Supabase para aplicarlo:
`npx supabase stop` y luego `npm run db:start`.

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

## Pruebas en el navegador (Playwright)

Necesitan Supabase local corriendo. El proyecto `setup` crea un usuario
sintético `@e2e.test`, inicia sesión y guarda la sesión fuera del repositorio
(en la carpeta temporal del sistema); el proyecto `limpieza` borra los usuarios
e2e al final.

La primera vez hay que descargar Chromium (unos 150 MB):

```sh
npx playwright install chromium
```

```sh
npm run test:e2e     # accesibilidad: axe (WCAG 2.2 AA), teclado, foco, 44 px, diálogo, movimiento y transparencia reducidos
npm run capturas     # capturas a 390, 768 y 1280 px en C:\dev\informes\sprint-2a (fuera del repositorio)
```

Compilan la app y la levantan en `127.0.0.1:3200`. La carpeta de capturas se
cambia con la variable `CAPTURAS_DIR`.

## Catálogo de diseño

`http://127.0.0.1:3000/diseno` muestra todos los componentes con datos de
ejemplo (sintéticos). Como toda la app, solo responde en localhost, pide
sesión y no aparece en el menú.

## Parámetros y textos

- `seed/parametros_iniciales.json`: tasas, reglas y entidades (versionado).
- `seed/textos_cotizacion.json`: textos de la pantalla y del PDF.

Se leen en cada petición: un cambio en esos archivos se ve sin reconstruir la app.

## Fuente del PDF

Nunito, con la SIL Open Font License 1.1 (`src/servidor/pdf/LICENCIA-Nunito-OFL.txt`),
instalada con `@fontsource/nunito`. La pantalla usa la misma fuente, empaquetada en
`src/app/fuentes/` (con su licencia) y cargada con `next/font/local`: nada sale de un CDN.
