# Crediflexi · Sistema interno de captación e inversiones

Mesa de trabajo interna para cotizar inversiones (Crediflexi / Rami Sise).
La especificación está en `BLUEPRINT.md` y las reglas de trabajo en `CLAUDE.md`.

## Dónde corre: desarrollo local y despliegue de prueba

Hay dos formas de correr la app, y **ninguna está lista para datos reales**:

- **Desarrollo local** (lo que describe casi todo este archivo): inicia sesión
  contra **Supabase local** (Docker). `npm run dev` y `npm run start` escuchan
  solo en `127.0.0.1`, y sin `HOSTS_PERMITIDOS` la app rechaza (403) cualquier
  petición cuyo encabezado `Host` no sea `localhost`, `127.0.0.1` o `[::1]`.
- **Despliegue de prueba** en Vercel y Supabase en la nube, con datos
  sintéticos y la franja "ENTORNO DE PRUEBA" visible: ver
  [Despliegue de prueba](#despliegue-de-prueba).

En los dos casos: sin segundo factor, solo datos sintéticos, y **no se debe
desplegar con datos reales** hasta cumplir la
[lista previa a datos reales](#antes-de-capturar-datos-reales). La lista de
hosts es un seguro contra un despliegue por accidente o bajo una dirección no
prevista, no seguridad real.

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

### Usuarios fijos de desarrollo (seed)

Para tener siempre los mismos cuatro usuarios después de cada reset, con una
sola contraseña que **no se sube a git**:

```sh
npm run seed:dev                                # contraseña aleatoria (se muestra una vez)
npm run seed:dev -- --contrasena <contraseña>   # o una elegida (12 caracteres o más)
npm run db:reset                                # BORRA los datos locales y aplica migraciones + seed
```

`seed:dev` escribe `supabase/seeds/local/usuarios_dev.sql` (ignorado por git) y
`supabase/config.toml` lo carga en cada `db reset`. Crea la "Organización de
Prueba" con la "Sucursal de Prueba" y la cadena de mando
`director@prueba.local` (director regional) → `gerente@prueba.local` (gerente) →
`ejecutivo1@prueba.local` y `ejecutivo2@prueba.local` (ejecutivos). Después,
cada `npm run db:reset` los vuelve a crear con la misma contraseña; para
cambiarla, corre `seed:dev` otra vez. En un clon nuevo el archivo no existe y
el reset simplemente no crea estos usuarios.

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
ejemplo (sintéticos). Como toda la app, solo responde en los hosts permitidos, pide
sesión y no aparece en el menú.

## Parámetros y textos

- `seed/parametros_iniciales.json`: tasas, reglas y entidades (versionado).
- `seed/textos_cotizacion.json`: textos de la pantalla y del PDF.

Se leen en cada petición: un cambio en esos archivos se ve sin reconstruir la app.

## Fuente del PDF

Nunito, con la SIL Open Font License 1.1 (`src/servidor/pdf/LICENCIA-Nunito-OFL.txt`),
instalada con `@fontsource/nunito`. La pantalla usa la misma fuente, empaquetada en
`src/app/fuentes/` (con su licencia) y cargada con `next/font/local`: nada sale de un CDN.

## Despliegue de prueba

Guía para quien haga el despliegue de prueba en **Supabase** (base de datos,
sesión y almacenamiento) y **Vercel** (la app). Es un entorno de prueba: solo
datos sintéticos, y la franja "ENTORNO DE PRUEBA" se ve en todas las pantallas.

Los nombres de botones, menús y secciones de los paneles de Supabase y Vercel
cambian con el tiempo, así que aquí se describe **qué** lograr en cada paso, no
dónde hacer clic: **verifícalo en el panel**.

**Ningún secreto en chats ni en archivos.** No pegues contraseñas, llaves ni
tokens en ningún chat, correo, documento ni archivo del repositorio. Escríbelos
solo en tu terminal o en el panel que los pide. La llave secreta (o de servicio)
de Supabase **no** se usa en el despliegue.

### Avisos de los planes gratuitos

Lo siguiente era cierto al escribir esta guía, pero cambia: **verifícalo en la
página de precios** de cada servicio antes de empezar.

- **Vercel Hobby** es para uso personal y no comercial. Una herramienta interna
  de una empresa probablemente necesita un plan de pago.
- El **plan gratuito de Supabase pausa el proyecto** tras una semana sin uso
  (hay que reactivarlo desde el panel) y **no incluye respaldos**.
- **Vercel limita a 4.5 MB** el cuerpo de cada petición y de cada respuesta de
  una función. Por eso la Biblioteca y la importación del Excel aceptan hasta
  4 MB, y los videos y archivos grandes van como enlace.

### 1. Crear el proyecto de Supabase

1. Crea un proyecto nuevo en Supabase. Guarda la contraseña de la base de datos
   en un gestor de contraseñas, no en un chat ni en un archivo.
2. Anota la referencia del proyecto (el identificador corto que aparece en su
   dirección `https://<referencia>.supabase.co`). No es secreta.

### 2. Aplicar las migraciones

Desde esta carpeta, con la CLI de Supabase que viene en las dependencias:

```sh
npx supabase login                               # abre el navegador para autorizar la CLI
npx supabase link --project-ref <referencia>     # pide la contraseña de la base: escríbela solo aquí
npx supabase db push                             # aplica supabase/migrations/ al proyecto de la nube
```

`db push` aplica solo las migraciones (tablas, políticas de RLS y el bucket
`biblioteca`); no carga los usuarios sintéticos locales. Si te pide
confirmación, revisa la lista de migraciones antes de aceptar.

### 3. Cerrar el registro y exigir contraseñas fuertes

`supabase/config.toml` solo aplica a Supabase local: en la nube hay que ponerlo
a mano en la configuración de autenticación del proyecto (**verifícalo en el
panel**):

1. **Cerrar el registro público**: que nadie pueda crearse una cuenta por su
   cuenta; las cuentas solo las crea quien administra.
2. **Contraseñas de 12 caracteres como mínimo, con mayúscula, minúscula y
   dígito** (lo mismo que `minimum_password_length` y `password_requirements`
   en `supabase/config.toml`).
3. **Confirmar que el inicio de sesión por correo y contraseña sigue activo**:
   al cerrar el registro, el proveedor de correo no debe quedar desactivado, o
   nadie podrá entrar.

### 4. Crear los usuarios

Cada persona necesita dos cosas: su **cuenta** de autenticación y su **fila**
en `public.usuarios` (nombre, rol, sucursal y jefe).

1. Crea la cuenta a mano en la sección de usuarios de autenticación del panel,
   con correo y contraseña (**verifícalo en el panel**). Usa correos sintéticos
   (por ejemplo, `@ejemplo.test`) mientras sea un entorno de prueba. Copia el
   **uuid** de la cuenta.
2. Genera el SQL de su fila. El script solo imprime SQL: no se conecta a nada
   ni lee el entorno ni llaves.

   ```sh
   # La primera persona de una sucursal nueva (crea la organización y la sucursal si no existen):
   node scripts/sql-alta-usuario.mjs --auth-id <uuid-de-la-cuenta> --nombre "Dana Sintética" \
     --rol DIRECTOR_REGIONAL --sucursal "Sucursal Sintética" \
     --crear-sucursal --organizacion "Organización Sintética"

   # Alguien con jefe: --jefe-id es el id de public.usuarios del jefe (lo devuelve el SQL anterior)
   node scripts/sql-alta-usuario.mjs --auth-id <uuid-de-la-cuenta> --nombre "Ana Sintética" \
     --rol EJECUTIVO --sucursal "Sucursal Sintética" --jefe-id <id-del-jefe>
   ```

   Roles: `DIRECTOR_REGIONAL`, `GERENTE` y `EJECUTIVO`. Los textos van de 1 a
   150 caracteres, en una sola línea y sin barra invertida. Con `--organizacion`
   (sin `--crear-sucursal`) la sucursal se busca solo dentro de esa organización.
3. Revisa el SQL y córrelo en el editor de SQL del proyecto. Va en una
   transacción: si algo falla (la sucursal no existe, su nombre se repite entre
   organizaciones, el jefe es de otra organización), no inserta nada.
4. Comparte la contraseña inicial por un canal seguro, nunca por el chat del
   equipo.

### 5. Importar el repositorio en Vercel

1. Crea un proyecto en Vercel importando este repositorio. El tipo de proyecto
   es Next.js y el comando de compilación es el de `package.json`
   (`next build`); **verifícalo en el panel**. Usa Node 24, como en local.
2. Pon las variables de entorno del proyecto (**ninguna lleva el prefijo
   `NEXT_PUBLIC_`**: así no llegan al navegador):

   | Variable | Valor |
   | --- | --- |
   | `SUPABASE_URL` | `https://<referencia>.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | la llave **publicable** del proyecto de Supabase (nunca la secreta ni la de servicio) |
   | `HOSTS_PERMITIDOS` | la dirección de Vercel, sin `https://` (ver el paso 6) |
   | `ENTORNO` | `prueba` |

   Si `HOSTS_PERMITIDOS` o `ENTORNO` están mal formadas, la compilación falla a
   propósito, con un mensaje que dice qué corregir.

### 6. Primer despliegue, dirección y redespliegue

1. Haz el primer despliegue **sin** `HOSTS_PERMITIDOS`. Sin esa variable, la app
   solo acepta los hosts locales, así que en la dirección de Vercel responde
   **403** ("Esta dirección no está autorizada para esta aplicación."). **Es lo
   esperado.**
2. Busca la dirección de producción que Vercel le dio al proyecto (algo como
   `mi-proyecto.vercel.app`; **verifícalo en el panel**).
3. Ponla en `HOSTS_PERMITIDOS`, exacta y sin `https://` ni diagonal final. Si
   hay más de una, sepáralas con comas. No se aceptan comodines.
4. Vuelve a desplegar: las variables nuevas solo se leen en un despliegue
   nuevo. Ahora `/acceso` debe abrir con la franja "ENTORNO DE PRUEBA".

Las direcciones de vista previa de Vercel (una por rama o por despliegue)
cambian cada vez y no están en la lista, así que responden 403.

### Lista de humo del primer despliegue

Con un usuario sintético de cada rol, en la dirección de Vercel:

- [ ] Iniciar sesión y cerrar sesión; un correo o contraseña incorrectos dan el mensaje de error.
- [ ] Cotización con PDF en pesos.
- [ ] Cotización con PDF en dólares (USD).
- [ ] Cotización con plazo especial, con PDF.
- [ ] Pipeline: exportar el Excel e importar uno de unos 4 MB.
- [ ] Comisiones con PDF.
- [ ] Reclutamiento con PDF.
- [ ] Biblioteca con subcarpetas: crear una subcarpeta, subir un archivo, verlo y descargarlo.
- [ ] La franja "ENTORNO DE PRUEBA" se ve en todas las pantallas y en `/acceso`.

Esta lista es la comprobación real de que Vercel empaqueta lo que necesitan los
PDF y el Excel (archivos de `seed/`, fuentes y logos): el trazado de `next build`
en local no lo garantiza.

### Antes de capturar datos reales

Nada de esto está hecho. Hasta cumplir **toda** la lista, solo datos sintéticos:

- [ ] Autorización **por escrito** del dueño para usar la app con datos reales.
- [ ] Cuentas de Supabase y Vercel **de la empresa**, no personales, con un plan que permita uso comercial.
- [ ] Respaldos de la base **y** del almacenamiento (Biblioteca), con una **prueba de restauración** hecha.
- [ ] **Segundo factor** (MFA) activo, o el riesgo de no tenerlo **aceptado por escrito**.
- [ ] **Aviso de privacidad** publicado y entregado a quien corresponda.
- [ ] **Borrar los usuarios sintéticos** (cuentas y filas) y los datos de prueba.
- [ ] Revisar las políticas de RLS y del almacenamiento contra el proyecto de la nube.
- [ ] Cambiar `ENTORNO=produccion` (quita la franja) y volver a desplegar.
