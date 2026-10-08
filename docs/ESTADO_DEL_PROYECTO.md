# Estado del proyecto — App interna de captación (Crediflexi / Rami Sise)

**Actualizado:** 8 de octubre de 2026 (secciones 0, 2, 3, 4, 6 y 8 con lo verificado en git ese día). **Dueño:** Fernando Rocha (ejecutivo de inversiones).
**Para quién es este documento:** para retomar el trabajo en una conversación nueva sin perder nada. Si algo de aquí contradice lo que ves en el repositorio, manda el repositorio (`git log`, `git status`) y se corrige este archivo.

## 0. Cómo retomar (primeros pasos en una conversación nueva)

1. Pedirle a Fernando que corra, dentro de `C:\dev\crediflexi` (el prompt debe terminar en `C:\dev\crediflexi>`), estos tres comandos, uno a la vez: `git branch`, `git log --oneline -8` y `git status`.
2. Verificado con git el 8 de octubre de 2026:
   - `origin/main` = `654d5a8` (Sprint 2b hasta la etapa D y el tope ZIP).
   - `main` local = `e84a959`: además trae el Sprint 3a, adelantado solo en local y **sin subir** (5 commits por delante de `origin/main`).
   - La rama `sprint-4` = `d66a504` sale de ese `main` y trae el Sprint 4, sin fusionar ni subir.
   - `sprint-3a` no tiene upstream.
3. Preguntarle a Fernando si ya revisó el Sprint 4 y si quiere fusionarlo a `main` y subir (`git push` solo con su permiso).
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
| 2b, etapa A | Tabla `prospectos` con seguridad por fila (migración `20261005120000_prospectos.sql`), 79 pruebas de seguridad nuevas, mutaciones 10 a 18 | ✅ en `main` y en `origin/main` (`f899646`) |
| Calendario del PDF | Página 2 del PDF: calendario de las dos modalidades y comparación; el PDF pasa a 2 páginas | ✅ en `main` y en `origin/main` (`d3fe522`, `8984277`, `edfed10`, `2d35d74`; fusionado con `6e04a2b`) |
| 2b, etapas B1, B2, C y D | Sesión con Supabase (proxy, acceso, usuarios sintéticos), seguridad por usuario activo, pipeline (alta, edición, archivo, filtros, semana), Excel del pipeline (exportar e importar) y tope real contra bombas ZIP | ✅ en `main` y en `origin/main` (`161e05c`, `d8ee80e`, `a8fdfc3`, `5c9dd04`, `654d5a8`) |
| 3a | USD solo para Rami Sise (semilla 0.7); puntos extra y plazo especial; PDF con SIPRES (solo Rami Sise), aviso del fondo, Modalidad 2 anualizada, sin reinversión y terminología "ganancia" (textos 0.5); comparativo de tasas en la página 2 (`seed/benchmark.json` 0.2) | ✅ en `main` local, **sin subir** (`c975adc` a `e84a959`) |
| 4 | Motor de comisiones (`src/domain/comisiones`, semilla 0.8), simulador `/comisiones` (interno y externo, desbloqueo al 80%, bono, calendario por quincena) y modo reclutamiento `/comisiones/reclutamiento` con el PDF "Propuesta de ingresos" (textos 0.6) | ✅ en la rama `sprint-4` (`ee82598` a `d66a504`), sin fusionar ni subir |

Respaldo: se hizo un bundle de git (`C:\dev\respaldos\crediflexi-sprint0a.bundle`) y la copia remota privada en GitHub (repositorio `crediflexi-inversiones`). Se verificó una restauración desde GitHub con éxito en octubre 1.

## 3. Qué está en curso

**Sprint 4** (rama `sprint-4`): terminado; falta la revisión de Fernando y decidir cuándo se fusiona a `main` y se sube. Informe: `C:\dev\informes\paso59-4.md`. Capturas y PDF de muestra: `C:\dev\informes\sprint-4`. Puntos por confirmar con él (también en `PENDIENTES_TECNICOS.md`, (qqq) a (zzz)):
- en el modo reclutamiento, el monto de cada plazo se reparte en "inversiones por plazo" (1 a 20) con su aviso; el nombre de quien presenta se limpia, se corta a 60 caracteres y no admite lenguaje de promesa;
- la red externa ya no suma a la meta (decisión de Fernando, semilla 0.8.1); el gerente tiene un bono de 30% de la comisión N1 de su equipo, por confirmar; su meta se mide sobre su propia captación (confirmado);
- sueldo base de $15,000 como "Sueldo base (propuesta)", solo para el Ejecutivo interno y nunca en reclutamiento;
- el texto del modo reclutamiento ya lo revisó y aprobó RH (confirmado el 8 de octubre de 2026; se quitó el aviso interno, textos 0.6.2).

**Sprint 2b, etapa E** (Envío del viernes, Inicio, respaldo y documentación): no se ha hecho.

**Logo de Rami Sise:** `public/logo-rami-sise.png` no existe. Los PDF de Rami Sise salen con el logo de Crediflexi y el de reclutamiento solo con el de Crediflexi (pendiente (kkk)).

## 4. Orden de lo que sigue

Hecho: 2a, 2b (etapas A a D), 3a y 4 (simulador de comisiones, sin guardar inversiones). Lo que sigue, en el orden original:
1. **2b, etapa E:** "Envío del viernes", Inicio, respaldo y documentación. Segundo factor (MFA) antes de salir de localhost.
2. **2c** **plan semanal** y **proyección** con exportación a Excel.
3. **2d** **Cartera** (mini CRM) y registro de cierres, con vencimientos a 30, 60 y 90 días. Con ella, las comisiones pueden leer las inversiones reales en vez de simularlas (pendiente (qqq)).
4. **2e** **Biblioteca de documentos** de la empresa (se puede adelantar).
5. **Red de externos** (rol EXTERNO, pendiente (rrr)) y **checklist de alta**.
6. **Parámetros editables** con historial.
7. **Agente IA** (se cobra por uso; usa los mismos permisos del usuario).

## 5. Módulos definidos (qué ve y hace cada usuario)

- **Inicio:** tablero del día. Ejecutivo: meta del mes con anillo, pipeline por estatus, seguimientos de hoy, proyección, plan de hoy, envío del viernes, cartera y vencimientos, documentos por vencer. Gerente: además el equipo. Director: por sucursal y gerente.
- **Cotizador y PDF:** ya funciona (sección 6).
- **Pipeline:** prospectos con tres estatus (INTERESADO, INTERMITENTE, NO INTERESADO), fecha de seguimiento, filtros por estatus y semana. Importa el Excel actual y exporta el suyo. Un prospecto que cierra pasa a Cartera.
- **Plan semanal:** lunes a viernes, 9:00 a 18:00, "¿Dónde?" (Sucursal, Campo, Comida) y "Qué" (Gestión cartera, Carta invitación, Llamadas, o cita ligada a un prospecto). Copia la semana anterior.
- **Proyección:** fecha, ejecutivo, cantidad, % de cierre, inversionista (tomado del pipeline). Total simple (el del Excel) y total ponderado (solo en pantalla).
- **Cartera (mini CRM):** cliente (nombre, teléfono, correo opcional, ejecutivo, origen, fecha de alta) e inversiones (entidad, monto, plazo, esquema, tasa congelada, inicio, vencimiento, tipo, estado). Lista con filtros, ficha por cliente, alertas de vencimientos. Guardia contra texto que parezca CLABE, RFC o CURP en notas. El vencimiento se calcula como inicio + plazo y se puede corregir.
- **Biblioteca:** documentos públicos o internos de la empresa (registros, constancias públicas, contratos modelo en blanco, material comercial, capacitación, marca, formatos en blanco). Categorías editables, versiones, vigencia con alertas, casilla "sin datos personales", tope 25 MB, almacenamiento privado, bitácora, suben directores y gerentes. Se excluyen por defecto las cuentas bancarias de la empresa.
- **Metas y comisiones:** meta mensual (1,000,000 ejecutivo; 2,000,000 gerente), comisión que se acumula pero queda **bloqueada hasta el 80%** de la meta (solo con captación nueva), después se paga todo lo del mes, nuevas y renovaciones. La red externa ya no cuenta para la meta; el gerente tiene un bono de 30% de la comisión N1 de su equipo (por confirmar). **Hoy es un simulador en `/comisiones`** (Sprint 4): nada se guarda. Tabla N1 con tasas completas; pago por quincena (del 1 al 15, el 16; del 16 a fin de mes, el 1 del siguiente). Modo reclutamiento para candidatos a externos en `/comisiones/reclutamiento`.
- **Red de externos, checklist de alta, parámetros, agente IA:** como se describe en la sección 4.

## 6. Cotizador: reglas y datos vigentes

- **Tasas correctas:** la Tabla de Diseño (imagen y Excel `Tasas_Interes_Pesos_y_Dolares_2026.xlsx`; se compararon celda por celda y coinciden). Plazos 6, 12, 18 y 24 meses. Dos esquemas: rendimientos mensuales y al final del plazo. Tramos que empiezan en 30,000; 200,001; 400,001; 600,001; 800,001 y 1,000,001 (un monto exacto de 200,000 paga el tramo 1; un monto con centavos entre 200,000.00 y 200,000.99 cae en el tramo 1).
- **Decisiones y por qué:** el PowerPoint de ejemplos (`TABLA_RENDIMIENTOS_EJEMPLOS.pptx`) **se descartó**: traía 20% para $30,000 y límites distintos. **No existe el plazo de 36 meses.** USD: solo para Rami Sise (semilla 0.7, Sprint 3a), con prueba de oro propia (`tests/golden/rendimientos_usd.json`).
- **Ajustes de tasa (Sprint 3a):** puntos extra de 0 a 5.0 en pasos de 0.5 sobre la tasa de tabla de las dos modalidades, con desglose "Tasa de tabla X% + Y puntos extra = Z%"; plazo especial de 1 a 24 meses con tasa acordada por modalidad (aviso no bloqueante si pasa de la máxima de la tabla más 5 puntos). Esos umbrales siguen en código (pendiente (ooo)).
- **Cálculo:** interés simple. Salidas: pago mensual (monto × tasa ÷ 12), rendimiento anual equivalente (monto × tasa) y ganancia total del plazo (monto × tasa × meses ÷ 12). Cada cifra se redondea una sola vez desde su valor exacto. El anual es un equivalente a 12 meses, no lo que recibe el cliente en plazos menores a 12.
- **Archivos de datos** (en la rama `sprint-4`):
  - `seed/parametros_iniciales.json` **v0.8.1**: tasas, tramos, comisiones N1 a N3, incentivos con bono numérico, parámetros de comisión y bono de gerente (sin la red externa).
  - `seed/textos_cotizacion.json` **v0.6.2**: bloques `pdf_pagina2` (con el comparativo) y `reclutamiento` (con el aviso de inversiones por plazo; sin el aviso interno de revisión).
  - `seed/benchmark.json` **v0.2**.
  - `tests/golden/rendimientos_pptx.json` **v0.5** (168 celdas; el nombre quedó por historia, ya no trae datos del pptx) y `tests/golden/rendimientos_usd.json` (128 celdas).
- **Entidades:** CREDIFLEXI, S.A.P.I. DE C.V. y RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R. Hoy usan la misma tabla de tasas en pesos. Logo del PDF: siempre Crediflexi (el de Rami Sise falta). Pitágoras es la marca comercial de los servicios financieros.
- **PDF de la cotización:** Carta, **exactamente 2 páginas** ("Página N de 2"), fuente Nunito (licencia OFL).
  - Página 1: cifra principal, la línea "Pago de la ganancia: cada mes / al vencimiento", resumen, resultados y "Cómo se calculó".
  - Pie de las dos páginas: aviso del fondo (acción de $1,000.00 MXN) y, solo con Rami Sise, la línea SIPRES.
  - **Sin promesas propias**; una prueba vigila el lenguaje prohibido, con la línea SIPRES exacta como única excepción.
- **Página 2 del PDF:**
  - Las dos modalidades lado a lado, con su franja de tiempo. Modalidad 1 con su tabla mes a mes; Modalidad 2 anualizada, sin filas.
  - Comparación de modalidades.
  - Comparativo de tasas (CETES, Nu, Mercado Pago): se omite en USD y con datos de más de 30 días.
  - Ya **no** lleva el escenario de reinversión (`escenario.ts` quedó sin usar).
  - Bandas #00860D (verde) y #8F7104 (mostaza), con 4.5:1 de contraste con texto blanco.
- **PDF "Propuesta de ingresos"** (modo reclutamiento): una página, con el aviso fijo "no es una oferta de empleo ni una garantía de ingresos".
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
- Reglas de comisión ya confirmadas (semilla 0.8, 7 de octubre de 2026): las renovaciones pagan comisión y no cuentan para la meta; tasas completas, sin redondear; nivel vigente N1; desbloqueo al 80% de la captación nueva.
- Reglas de comisión aún por confirmar:
  - el nivel de cada persona (N2 y N3 sin uso);
  - qué pasa con la comisión bloqueada si el mes cierra por debajo del 80% (hoy "se pierde", por confirmar);
  - el bono de gerente en sí (30% de la comisión N1 del equipo). Confirmado el 8 de octubre de 2026: la meta del gerente se mide sobre su propia captación y el bono no requiere que el equipo desbloquee;
  - fecha de pago del sueldo base y del bono;
  - bono del Gerente.
- Cuándo cuenta una inversión como captada: hoy se supone la fecha de inicio de la inversión, por confirmar.
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

> Estoy continuando el proyecto de la app interna de Crediflexi. Lee `docs/ESTADO_DEL_PROYECTO.md`, que tiene dónde vamos y el protocolo de trabajo. Primero dime qué comandos de git quieres que corra para confirmar el estado. Luego decidimos si fusiono el Sprint 4 a `main` y qué sigue (etapa E del Sprint 2b, plan semanal o Cartera).
