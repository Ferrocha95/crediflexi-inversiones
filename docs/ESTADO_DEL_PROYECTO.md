# Estado del proyecto — App interna de captación (Crediflexi / Rami Sise)

**Actualizado:** 5 de octubre de 2026 (secciones 0, 2, 3 y 6 con lo verificado en git ese día). **Dueño:** Fernando Rocha (ejecutivo de inversiones).
**Para quién es este documento:** para retomar el trabajo en una conversación nueva sin perder nada. Si algo de aquí contradice lo que ves en el repositorio, manda el repositorio (`git log`, `git status`) y se corrige este archivo.

## 0. Cómo retomar (primeros pasos en una conversación nueva)

1. Pedirle a Fernando que corra, dentro de `C:\dev\crediflexi` (el prompt debe terminar en `C:\dev\crediflexi>`), estos tres comandos, uno a la vez: `git branch`, `git log --oneline -8` y `git status`.
2. Verificado con git el 5 de octubre de 2026: `main` = `origin/main` = `efbcdae` y contiene los sprints 0a, 1a, 1b (incluido `307f13b`, tramos en pesos enteros) y 2a.
3. Hay dos ramas sin fusionar ni subir a GitHub: `sprint-2b` (etapa A) y `calendario-pdf` (ver sección 3). Preguntarle a Fernando qué revisó y qué quiere fusionar.
4. Seguir el protocolo de la sección 9.

## 1. Qué es y para qué sirve

Una mesa de trabajo interna para cotizar, llevar el pipeline, planear la semana, proyectar cierres, medir meta y comisiones, y **sacar cada viernes los dos Excel que hoy se arman a mano**. Uso interno de 3 a 4 personas al inicio, diseñada desde el primer día con roles y sucursales. Objetivo de fondo: migrar todos los Excel y procesos manuales a una sola plataforma, con diseño premium (tema oscuro azul de marca, tarjetas de vidrio).

**Alcance fijo:**
- Sin datos sensibles: nada de RFC, CURP, CLABE, cuentas, tarjetas, INE, estados de cuenta, domicilio ni fecha de nacimiento. Eso vive en el CRM oficial de la empresa (HubSpot), que queda fuera.
- Sin integración con HubSpot, sin exportar a YUNIUS, sin enviar correos solo (la app prepara los archivos y Fernando los envía).
- Datos básicos de clientes sí (nombre, teléfono, monto invertido, vencimiento), con roles y bitácora.

## 2. Qué está hecho

| Sprint | Contenido | Estado |
|---|---|---|
| 0a | Base de datos con roles `DIRECTOR_REGIONAL`, `GERENTE`, `EJECUTIVO`, sucursales, cadena de mando, seguridad por fila, 116 pruebas de seguridad y pruebas de mutación (se rompieron las políticas a propósito y la suite lo detectó) | ✅ en `main` |
| 1a | Motor de tasas e interés en `src/domain`, pruebas de oro con valores independientes | ✅ en `main` (commit `24703fb`) |
| 1b | Cotizador `/cotizador` con vista previa, confirmación obligatoria y PDF de marca (dos entidades); solo local en 127.0.0.1; unas 890 pruebas unitarias | ✅ en `main` (verificado con git: `08cca23` a `ac7aa2f`, y `307f13b` "Tramos que empiezan en pesos enteros: semilla 0.6 y golden 0.5") |
| 2a | Sistema de diseño, Inicio, catálogo `/diseno`, cotizador rediseñado, pruebas en el navegador (Playwright) | ✅ en `main` (verificado con git: último commit `efbcdae`, igual a `origin/main`) |
| 2b, etapa A | Tabla `prospectos` con seguridad por fila (migración `20261005120000_prospectos.sql`), 79 pruebas de seguridad nuevas (195 en total), 9 mutaciones nuevas (10 a 18; 19 en total, todas muertas) | ✅ en la rama `sprint-2b`, commit `f899646`. Sin fusionar a `main` y sin subir (la rama no tiene upstream). Su `git status` quedó limpio al hacer el commit; **por verificar** que siga igual |
| Calendario del PDF | Página 2 del PDF: calendario de las dos modalidades, comparación de modalidades y escenario ilustrativo de reinversión; textos 0.4; el PDF pasa a 2 páginas | ✅ en la rama `calendario-pdf` (sale de `main`): `d3fe522` (dominio), `8984277` (modelo, escalas y textos 0.4), `edfed10` (página 2) y el commit de pendientes. Sin fusionar a `main` y sin subir |

Respaldo: se hizo un bundle de git (`C:\dev\respaldos\crediflexi-sprint0a.bundle`) y la copia remota privada en GitHub (repositorio `crediflexi-inversiones`). Se verificó una restauración desde GitHub con éxito en octubre 1.

## 3. Qué está en curso

**Sprint 2b** (rama `sprint-2b`): inicio de sesión, pipeline guardado, importación y exportación del Excel, "Envío del viernes" y respaldo local. El plan va por etapas:
- **A**, datos, seguridad y mutaciones: hecha (`f899646`).
- **B**, sesión: pendiente. Requiere aprobar la instalación de `@supabase/ssr` 0.12.7.
- **C**, pipeline: pendiente.
- **D**, Excel: pendiente. Se propuso ExcelJS 4.4.0; correr `npm audit` antes de instalar.
- **E**, Envío del viernes, Inicio, respaldo y documentación: pendiente.

Las notas aprobadas para B a E están en el plan de Claude Code. **Por verificar** que Fernando las tenga a la mano en la conversación nueva.

**Calendario del PDF** (rama `calendario-pdf`): terminado; falta la revisión de Fernando y decidir cuándo se fusiona.
- Las muestras de revisión visual (6 PDF con sus PNG) están en `C:\dev\informes\calendario-pdf`, fuera del repositorio.
- **Por verificar:** que Fernando haya revisado los PNG y el texto.
- **Ojo al fusionar:** esta rama y `sprint-2b` salen de `main` y las dos agregan líneas al final de `PENDIENTES_TECNICOS.md`. Se esperan conflictos sencillos en ese archivo.

## 4. Orden de lo que sigue

1. **2a** diseño y estructura (en curso).
2. **2b** inicio de sesión (con segundo factor), guardado en base de datos, **pipeline** con importación de su Excel y exportación en su formato, y "Envío del viernes".
3. **2c** **plan semanal** y **proyección** con exportación a Excel.
4. **2d** **Cartera** (mini CRM) y registro de cierres, con vencimientos a 30, 60 y 90 días.
5. **2e** **Biblioteca de documentos** de la empresa (se puede adelantar).
6. **Metas y comisiones** (depende de reglas pendientes).
7. **Red de externos** y **checklist de alta**.
8. **Parámetros editables** con historial.
9. **Agente IA** (se cobra por uso; usa los mismos permisos del usuario).

## 5. Módulos definidos (qué ve y hace cada usuario)

- **Inicio:** tablero del día. Ejecutivo: meta del mes con anillo, pipeline por estatus, seguimientos de hoy, proyección, plan de hoy, envío del viernes, cartera y vencimientos, documentos por vencer. Gerente: además el equipo. Director: por sucursal y gerente.
- **Cotizador y PDF:** ya funciona (sección 6).
- **Pipeline:** prospectos con tres estatus (INTERESADO, INTERMITENTE, NO INTERESADO), fecha de seguimiento, filtros por estatus y semana. Importa el Excel actual y exporta el suyo. Un prospecto que cierra pasa a Cartera.
- **Plan semanal:** lunes a viernes, 9:00 a 18:00, "¿Dónde?" (Sucursal, Campo, Comida) y "Qué" (Gestión cartera, Carta invitación, Llamadas, o cita ligada a un prospecto). Copia la semana anterior.
- **Proyección:** fecha, ejecutivo, cantidad, % de cierre, inversionista (tomado del pipeline). Total simple (el del Excel) y total ponderado (solo en pantalla).
- **Cartera (mini CRM):** cliente (nombre, teléfono, correo opcional, ejecutivo, origen, fecha de alta) e inversiones (entidad, monto, plazo, esquema, tasa congelada, inicio, vencimiento, tipo, estado). Lista con filtros, ficha por cliente, alertas de vencimientos. Guardia contra texto que parezca CLABE, RFC o CURP en notas. El vencimiento se calcula como inicio + plazo y se puede corregir.
- **Biblioteca:** documentos públicos o internos de la empresa (registros, constancias públicas, contratos modelo en blanco, material comercial, capacitación, marca, formatos en blanco). Categorías editables, versiones, vigencia con alertas, casilla "sin datos personales", tope 25 MB, almacenamiento privado, bitácora, suben directores y gerentes. Se excluyen por defecto las cuentas bancarias de la empresa.
- **Metas y comisiones:** meta mensual (1,000,000 ejecutivo; 2,000,000 gerente), comisión que se acumula pero queda **bloqueada hasta el 80%** de la meta, después desbloqueada; simulador "si cierro X"; red (30% de lo de externos).
- **Red de externos, checklist de alta, parámetros, agente IA:** como se describe en la sección 4.

## 6. Cotizador: reglas y datos vigentes

- **Tasas correctas:** la Tabla de Diseño (imagen y Excel `Tasas_Interes_Pesos_y_Dolares_2026.xlsx`; se compararon celda por celda y coinciden). Plazos 6, 12, 18 y 24 meses. Dos esquemas: rendimientos mensuales y al final del plazo. Tramos que empiezan en 30,000; 200,001; 400,001; 600,001; 800,001 y 1,000,001 (un monto exacto de 200,000 paga el tramo 1; un monto con centavos entre 200,000.00 y 200,000.99 cae en el tramo 1).
- **Decisiones y por qué:** el PowerPoint de ejemplos (`TABLA_RENDIMIENTOS_EJEMPLOS.pptx`) **se descartó**: traía 20% para $30,000 y límites distintos. **No existe el plazo de 36 meses.** USD sigue `POR_CONFIRMAR` y deshabilitado.
- **Cálculo:** interés simple. Salidas: pago mensual (monto × tasa ÷ 12), rendimiento anual equivalente (monto × tasa) y ganancia total del plazo (monto × tasa × meses ÷ 12). Cada cifra se redondea una sola vez desde su valor exacto. El anual es un equivalente a 12 meses, no lo que recibe el cliente en plazos menores a 12.
- **Archivos de datos:** `seed/parametros_iniciales.json` **v0.6** (tasas, tramos, comisiones N1 verificadas, incentivos, parámetros), `seed/textos_cotizacion.json` **v0.3** en `main` y **v0.4** en `calendario-pdf` (agrega el bloque `pdf_pagina2`), `tests/golden/rendimientos_pptx.json` **v0.5** (168 celdas; el nombre quedó por historia, ya no trae datos del pptx).
- **Entidades:** CREDIFLEXI, S.A.P.I. DE C.V. y RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R. Hoy usan la misma tabla de tasas. Logo del PDF: siempre Crediflexi. Pitágoras es la marca comercial de los servicios financieros.
- **PDF:** Carta, una página, fuente Nunito (licencia OFL), cifra principal grande, resumen, resultados, "Cómo se calculó", franja de contacto y pie con texto base fijo (opción 3 del pie). **Sin textos legales ni promesas propias**; una prueba vigila que no aparezcan palabras como garantizado, sin riesgo, neta, libre de impuestos, supervisada, CNBV, CONDUSEF.
- **Página 2 del PDF** (solo en la rama `calendario-pdf`):
  - Siempre las dos modalidades lado a lado. Modalidad 1: el último pago ajusta los centavos. Modalidad 2: diferencia de acumulados redondeados.
  - Comparación de modalidades.
  - Escenario ilustrativo de reinversión a dos plazos, con la tasa que corresponde al capital de cada mes. Se omite si el primer pago es menor a $1,000 o si falta una tasa.
  - Bandas #00860D (verde) y #8F7104 (mostaza), con 4.5:1 de contraste con texto blanco.
  - El PDF tiene siempre 2 páginas, con "Página N de 2".
- **Protecciones del cotizador:** solo atiende a Host local (no es seguridad real, es un seguro contra despliegue accidental), `npm run dev` y `start` escuchan solo en 127.0.0.1, nada de lo escrito se guarda, el PDF recalcula en el servidor y detecta si las tasas cambiaron entre la vista previa y la descarga.

## 7. Formatos de Excel (cada viernes por correo)

Detalle exacto (anchos, celdas combinadas, formatos, colores) en `docs/FORMATOS_EXCEL.md`. Resumen:
- `PIPELINE_{MES}.xlsx`: hoja `PROSPECTOS SUCURSAL`. Encabezado azul #012553 con imagen. Columnas NOMBRE, CONTACTO, COMENTARIOS, ESTATUS, SEGUIMIENTO, EJECUTIVO. **Toda la fila se pinta por estatus:** INTERESADO #A8D08D, INTERMITENTE #FFD965, NO INTERESADO #F4B083. Lleva los prospectos de la semana.
- `PLAN_Y_PROYECCION_SEMANAL_DEL_{d1}_AL_{d2}_DE_{MES}_DEL_{año}.xlsx`: hojas `PLANEACIÓN SEMANAL` (lunes a viernes, sin columnas de domingo y sábado) y `PROYECCIÓN SEMANAL` (total simple).
- Imagen de encabezado: `public/logo-encabezado-excel.png` (transparente, logo blanco con "FONDO DE INVERSIÓN PRIVADO").
- Datos sucios que la app debe impedir: estatus con espacio al final, fila sin ejecutivo, fecha de seguimiento de otro año, teléfono guardado como número.
- Los Excel reales **no van al repositorio** (`*.xlsx`, `*.csv` y `*.pdf` están en `.gitignore`).

## 8. Pendientes

**De negocio (decide Fernando):**
- Reglas de comisión y bono: nivel N1, N2 o N3 de cada persona, bono por quincena (la regla exacta no está en ningún archivo; la hoja "Calculadora" del Excel del bono está vacía), base del 30% de la red, qué pasa con la comisión bloqueada si cierra el mes por debajo del 80%, si las renovaciones pagan comisión y si cuentan para la meta.
- Cuándo cuenta una inversión como captada (firma, depósito o alta).
- Dónde vive la app para que otros la usen. Hoy corre solo en su computadora. Hechos verificados: Vercel Hobby no sirve para uso comercial según sus términos; Supabase gratuito no incluye respaldos automáticos, pausa tras una semana sin uso y da 1 GB de archivos; Supabase Pro cuesta desde 25 USD al mes; GitHub gratuito permite repositorios privados ilimitados. Otros hostings: sin verificar. El agente IA se cobra por uso (precio de Claude Haiku 4.5 según fuentes de terceros: 1 USD y 5 USD por millón de tokens, sin confirmar en la página oficial).
- Quién sube a la Biblioteca y si entran las cuentas bancarias de la empresa (recomendado que no).
- **Verificación en dos pasos de su cuenta de GitHub:** sin confirmar, con el repositorio ya en internet.
- Aclarar con la empresa de quién es lo construido si se piensa vender.

**Técnicos (lista completa en `PENDIENTES_TECNICOS.md`):** traducir errores de la base de datos a español; MFA en las políticas; convertir el trigger de cadena de mando a `security definer` antes de abrir escritura; rehacer las pruebas de escritura al abrir permisos; bitácora de cambios; `seed.sql` con datos sintéticos; `.gitattributes` para finales de línea; ESLint 9 descontinuado; semilla con `desde` y `hasta` como texto; vigencias y tablas por entidad; actualizar la sección 9 del blueprint; semilla sintética para pruebas de lógica; etiqueta legible para el estatus del tramo; prueba de extremo a extremo con Playwright; mapa de la lógica del plazo adicional sin uso real.

## 9. Protocolo de trabajo (aprendido a base de tropiezos)

**Con Fernando:** pasos pequeños, uno a la vez, y avanza cuando dice "listo". Quiere ahorrar tokens: sin pruebas ni ediciones de más. Tono directo, formal, motivador y con humor negro ligero. Cifras con fórmula y fuente; si algo no se puede confirmar, decirlo literalmente. Sus errores típicos: olvidar `cd` antes de una ruta y pegar varios comandos juntos. Dar los comandos de uno en uno y pedirle que confirme que el prompt termina en `C:\dev\crediflexi>`. No ve los PDFs ni los diseños por mí: pedirle capturas.

**Con Claude Code (siempre en modo manual):**
1. Primero un **plan** en modo plan (Shift + Tab). El plan no se aprueba hasta que Claude lo revise.
2. **Pruebas primero**: cada prueba nueva debe fallar antes de pasar. Si una prueba contra el golden falla, se arregla el código, nunca el golden ni la semilla.
3. No tocar `src/domain`, `seed/`, `tests/golden/` ni migraciones sin permiso explícito. Sin `git push` ni fusiones sin permiso.
4. Un commit por punto, mostrando `git status` y la lista exacta de archivos antes; escanear caracteres invisibles en archivos y mensajes.
5. Informes en `C:\dev\informes\paso{N}.md`; Fernando los copia al portapapeles y los pega en el chat. La señal de que Claude Code terminó es que exista el informe.
6. Los valores esperados de las pruebas salen de fuentes independientes (el golden o tablas calculadas fuera del motor), nunca de lo que devuelva el motor.
7. Las dependencias nuevas se verifican en su documentación oficial antes de instalar. Skills de terceros: no.

**Lecciones (errores ya cometidos, para no repetirlos):** una tabla de tasas se tomó de un PowerPoint sin cotejarla con el Excel y el folleto, y estaba mal; se dijo que el logo era transparente y no lo es (tiene fondo blanco; el de los Excel sí es transparente); un mensaje del dominio decía "sin comas" mientras la pantalla las aceptaba; hay que cotejar datos de entrada contra una segunda fuente antes de convertirlos en pruebas.

## 10. Entorno técnico

- Windows 11 Home (25H2), 16 GB de RAM. Node 24.15.0, npm 11.12.1, Git, Docker Desktop (WSL 3.0.1), Python 3.14.
- Supabase CLI 2.119.0, Postgres 17, local con Docker (API en 54321, base en 54322, panel en 54323, correo de prueba en 54324). Analytics desactivado.
- Next.js 16.3.8, React 19.2.8, TypeScript 5.9.3, Tailwind 4, Vitest 5.0.3, decimal.js 10.6.0, Zod 4.6.5, `@react-pdf/renderer` 4.9.0, `pdfjs-dist` 6.3.289 y `@napi-rs/canvas` 1.0.10 (solo desarrollo), fuente Nunito (`@fontsource/nunito` 5.3.0).
- Estructura: `src/domain` (motor, sin UI ni base de datos), `src/aplicacion` (funciones puras de pantalla y PDF), `src/servidor` (lectura de archivos y PDF), `src/app` (pantallas), `supabase/migrations`, `tests/unit`, `tests/rls`, `tests/golden`, `seed`, `docs`, `scripts/mutacion.mjs`, `public`.
- Archivos de referencia en la carpeta del Project: `BLUEPRINT_SISTEMA_INVERSIONES.md` (versión inicial, la manda `CLAUDE.md`), `CLAUDE.md`, y los Excel y PDFs de la empresa que se subieron como contexto (no van al repositorio).

## 11. Mensaje sugerido para abrir la conversación nueva

> Estoy continuando el proyecto de la app interna de Crediflexi. Lee `docs/ESTADO_DEL_PROYECTO.md`, que tiene dónde vamos y el protocolo de trabajo. Primero dime qué comandos de git quieres que corra para confirmar el estado, y luego retomamos en el Sprint 2a: ya instalé la skill de diseño y tengo (o no tengo) el plan de Claude Code para que lo revises.
