# BLUEPRINT — Sistema interno de captación e inversiones (Crediflexi / Rami Sise)

**Versión:** 0.1 · **Fecha:** 30-sep-2026 · **Autor del proyecto:** Fernando Rocha (Ejecutivo de Inversiones)
**Se construye con:** Claude Code · **Uso inicial:** interno, 3–4 personas · **Presupuesto inicial:** $0

Este documento tiene dos partes:

- **Parte A (humanos):** qué es el sistema, qué hace y cómo se calcula tu dinero. Sin jerga.
- **Parte B (Claude Code):** especificación técnica para construirlo.

Archivos que acompañan este documento:

| Archivo | Para qué sirve |
|---|---|
| `seed/parametros_iniciales.json` | Tasas, comisiones, incentivos y metas iniciales. Generado por código desde tus archivos, sin transcribir a mano |
| `assets/logo-crediflexi.png` | Logo (PNG transparente 1834×539, extraído del Excel de bonos) |

### Leyenda que usa todo el documento

| Marca | Significa |
|---|---|
| ✅ | Confirmado por ti o escrito en un archivo oficial |
| 🟡 | Supuesto razonable. **Arranca así, pero es editable** |
| ❓ | Falta información. Se implementa como parámetro editable y se pregunta |
| ⛔ | Bloquea algo hasta que alguien lo confirme |

**Regla de oro:** si algo está en ❓, **no se inventa**. Se construye como campo editable y se pregunta.

---

# PARTE A — PARA HUMANOS

## 1. La idea en 30 segundos

Hoy trabajas con unos 10 Excel, PDFs sueltos y mensajes. El sistema será **una sola mesa de trabajo** donde:

1. **Cotizas** con las tasas correctas y revisas el cálculo antes de generar el PDF para el cliente.
2. **Das de alta al inversionista** con una guía paso a paso que no te deja mandar nada incompleto (porque si te lo regresan, te descuentan).
3. **Ves tu dinero en vivo:** cuánto has captado, cuánto llevas de comisión, cuánto está bloqueado y cuánto te falta para desbloquearlo.
4. **Llevas tu pipeline y tu plan semanal** sin pelear con celdas.
5. **Guardas todos los documentos** ordenados y a la mano.
6. **Administras tu red de asesores externos**, cuya producción suma a tu meta.
7. Opcional y más adelante, un **agente IA** que conoce el negocio y te ayuda en lo comercial, lo administrativo y lo estratégico.

## 2. Qué es y qué NO es

| Es | No es |
|---|---|
| Tu mesa de trabajo y tu calculadora | El sistema oficial de la empresa |
| El lugar donde preparas todo **bien** | Un reemplazo de YUNIUS |
| Una app que exporta listo para cargar a YUNIUS | Un sistema contable o de pagos |
| Una herramienta para 3–4 personas al inicio | Algo que garantiza cero errores |

YUNIUS es el sistema de alta de fondeadores que aparece en `REQUISITOS_FONDEADORES.jpg`. **No puedo confirmar cómo funciona ni si acepta importación.** Por eso el trabajo de la app es dejarte el archivo listo y tú lo cargas.

Sobre el "cero errores": la app reduce los errores con validaciones. Pero hay reglas de YUNIUS y de Cumplimiento que no están en ningún archivo. Cada vez que te regresen algo, la app te pide registrar el motivo y se convierte en una regla nueva. Así se va volviendo a prueba de balas.

## 3. Quién usa qué

| Rol | Persona hoy | Qué ve y hace |
|---|---|---|
| Director regional de inversiones | Sergio Soto | Todo su ámbito. Edita parámetros |
| Gerente de inversiones | Xóchitl Rosas | Su equipo, su red y su propia meta |
| Ejecutivo de inversiones | Fernando Rocha y 1 más | Lo propio y su red |
| Asesor externo | (por dar de alta) | No entra al sistema al inicio. Lo registran su ejecutivo o gerente |

- Todos usan **la misma app**. Cambian los permisos y la meta.
- Todo usuario pertenece a una **sucursal**. En tus archivos aparecen Metepec, Toluca y Valle de Bravo. Así, si luego se comparte entre sucursales, no hay que rehacer nada.
- 🟡 **Quién puede editar parámetros:** dijiste "todos, principalmente el director regional". Arranca así: todos pueden editar, y **cada cambio queda registrado** con quién, cuándo y valor anterior, con botón para revertir. Mi recomendación: dejar las tasas y las tablas de comisión solo al Director. Es un interruptor en Configuración.

## 4. Un día en la vida del sistema

> **9:00** Entras. El tablero te dice: *"Llevas $650,000 de $1,000,000 (65%). Te faltan $150,000 para desbloquear tus comisiones. Comisión acumulada: $17,424 🔒."*
>
> **9:30** Un prospecto pide una propuesta. Eliges monto, plazo y tipo de pago. La app te muestra el cálculo paso a paso. Revisas, confirmas y **hasta ahí** se genera el PDF con el logo de Crediflexi y tus datos.
>
> **12:00** El prospecto acepta. Abres "Nueva alta". La app te guía por pasos: datos, documentos, beneficiarios, persona políticamente expuesta. Cada documento tiene semáforo. No deja avanzar con pendientes.
>
> **12:40** Todo verde. La app genera el archivo listo para YUNIUS y el formato de características de inversión.
>
> **Viernes 10:00** Te avisa que el reporte semanal y tu plan salen a las 11:00. Ya están armados con tu pipeline.

## 5. Los módulos, explicados simple

| # | Módulo | En una frase | Reemplaza |
|---|---|---|---|
| M1 | **Base** | Usuarios, roles, sucursales, logo, bitácora y parámetros editables | Nada (hoy no existe) |
| M2 | **Tasas y cotizador** | Una sola tabla de tasas y un cotizador con vista previa obligatoria | Calculadora, simulador, tablas repetidas |
| M3 | **Propuestas PDF** | El PDF de proyección para el cliente, con logo | Armar flyers a mano |
| M4 | **Alta y KYC guiado** | Un asistente que no te deja enviar algo incompleto | Layout, requisitos, revisión manual |
| M5 | **Inversiones y contratos** | Formato de características, carátula del contrato, calendario de pagos, renovaciones | `CARACTERISTICAS_DE_INVERSION.xlsx`, machotes |
| M6 | **Metas y comisiones** | Tu meta, tu avance, comisión bloqueada/desbloqueada, simulador | `Bono_Quincenal...xlsx` |
| M7 | **Pipeline y plan semanal** | Prospectos, seguimiento, plan por hora, proyección ponderada, reporte del viernes | `PIPELINE.xlsx`, plan y proyección semanal |
| M8 | **Red de externos** | Alta y seguimiento de asesores externos y su producción | Hojas sueltas |
| M9 | **Documentos** | Bóveda ordenada: corporativos, por inversionista y por inversión | Carpetas y chats |
| M10 | **Agente IA** (fase final) | Mano derecha que consulta todo con tus permisos | Preguntarle a alguien o buscar en PDFs |

**Alcance comercial:** solo los formatos de proyección de tasa o inversión que se mandan al cliente. Flyers, campañas y demás material los hace Marketing y no entran.

## 6. Cómo se calcula tu dinero

### 6.1 El interés (simple, sin capitalizar)

- **Rendimientos mensuales:** cada mes se paga `capital × tasa anual ÷ 12`.
- **Rendimientos al final del plazo:** al final se paga `capital × tasa anual × meses ÷ 12`.

Ejemplo verificado con el pptx: **$500,000 a 12 meses, 17.5% mensual**.
- Pago mensual = 500,000 × 0.175 ÷ 12 = **$7,291.67** (el pptx lo muestra redondeado a $7,292).
- Interés total = **$87,500.00**.

El pptx redondea a pesos enteros. La app calcula exacto y muestra 2 decimales. Tú ves ambos en la vista previa y confirmas.

### 6.2 Tu meta y el "desbloqueo"

- ✅ Tu meta es mensual. Hoy: Ejecutivo **$1,000,000**; Gerente **$2,000,000**. Ambas editables.
- ✅ **Cuenta para la meta:** captación nueva e incrementos de capital. 🟡 Las renovaciones no cuentan (editable).
- ✅ Tu comisión **se acumula desde el primer peso**, pero aparece **bloqueada** hasta llegar al **80%** de tu meta. Ahí pasa a **desbloqueada** y se cobra completa.
- ✅ La comisión se **paga por quincena**.

### 6.3 Ejemplo completo (ilustrativo)

Supón meta $1,000,000, umbral $800,000 y nivel de comisión N1 (tablas de `Bono_Quincenal`).

| Día | Cierre | Comisión | Captado | Estado |
|---|---|---|---|---|
| 5 | $250,000 a 12 meses | 250,000 × 2.64% = **$6,600** | 25% | 🔒 |
| 12 | $400,000 a 12 meses | 400,000 × 2.706% = **$10,824** | 65% | 🔒 acumulado **$17,424** |
| 15 | *Corte quincena 1* | — | 65% | 🔒 no se paga nada |
| 20 | $200,000 a 18 meses | 200,000 × 4.08% = **$8,160** | **85%** | 🔓 total **$25,584** |
| 30 | *Corte quincena 2* | — | 85% | 💰 se paga **$25,584** |

Esto asume 🟡 que:
- La comisión se calcula por inversión individual.
- El corte de quincena es 15 y fin de mes.
- Lo bloqueado se paga en el primer corte posterior al desbloqueo.

Todo eso es editable. Si cierras el mes por debajo del 80%, la app te muestra cuánto **dejaste de ganar** (🟡 por defecto se pierde; editable).

### 6.4 Tu red (externos)

- ✅ Lo que captan tus externos **suma al 100%** a tu meta.
- ✅ De lo que entra por un externo, cobras el **30% de la comisión**. Si **tú** lo metes, cobras el **100%**.
- ✅ A los externos les paga la misma empresa.
- ✅ La gerente cobra el 30% sobre lo que produzca su red (interna y externa), **solo si ella llega al 80%**.

Ejemplo ilustrativo 🟡: un externo mete $500,000 a 12 meses y suponemos nivel N2 para él. Comisión = 500,000 × 2.1648% = $10,824. Tu 30% = **$3,247.20**. Si lo metes tú con N1: 500,000 × 2.706% = **$13,530**.

Quién es N1, N2 o N3 lo defines en la app, y la base del 30% (la tabla de quién capta, o la tuya) también. Ver sección 7.

### 6.5 Bono extra

- ✅ Sigue vigente la propuesta de incentivos: sueldo base de $15,000 para internos, y sueldo adicional según tramo de meta. Todo editable.
- ❓ **La regla por quincena no está en ningún archivo.** `Bono_Quincenal` trae las tablas de comisión y los supuestos, pero su hoja "Calculadora" está vacía (solo título y logo). Arranca como: evaluación en los cortes de quincena 1 y 2, con los montos de la tabla de incentivos. Se ajusta cuando lo confirmen.

| Cumplimiento | Sueldo adicional interno | Sueldo adicional externo |
|---|---|---|
| 100% ($1,000,000–$1,499,999) | $0 + comisión | $15,000 + comisión |
| 150% ($1,500,000–$1,999,999) | $5,000 + comisión | $20,000 + comisión |
| 200% ($2,000,000 en adelante) | $10,000 + comisión | $25,000 + comisión |

La propuesta dice además que por debajo de $1,000,000 se evalúa la permanencia de los internos.

## 7. Pendientes y cómo arrancan

| # | Pendiente | Arranca como | Confirma |
|---|---|---|---|
| P1 | Regla exacta del bono por quincena | Tabla de incentivos evaluada en cortes Q1 y Q2 🟡 | Gerente |
| P2 | Comisión bloqueada si cierras abajo del 80% | Se pierde, se muestra como "no cobrada" 🟡 | Gerente |
| P3 | Base del 30% de la red | Tabla del nivel de quien capta 🟡 | Gerente |
| P4 | Nivel N1/N2/N3 por persona | **Sin nivel**. La app pide asignarlo. El simulador deja elegir ❓ | Director |
| P5 | Renovaciones | Pagan comisión con tablas de renovaciones; no cuentan para meta 🟡 | Gerente |
| P6 | Cascada de la red (¿gerente y ejecutivo cobran 30% sobre el mismo externo?) | Solo superior directo 🟡 | Gerente |
| P7 | Fecha que cuenta como "captación" | Fecha de depósito confirmado 🟡 | Gerente |
| P8 | Días de corte de quincena | 15 y último día del mes 🟡 | Gerente |
| P9 | Meta del Director regional | Vacía ❓ | Director |
| P10 | Tasas <$200,000 y límites de tramo | ⛔ Ver Anexo A | Director |
| P11 | Documentos del beneficiario (manual dice INE, estado de cuenta y CSF; la imagen de requisitos dice INE y comprobante de domicilio) | Checklist configurable, sin marcar como oficial ❓ | Cumplimiento |
| P12 | Formato KYC y guía "Speech Pitágoras" | No están en el Project. El agente funciona sin ellos hasta que los subas ❓ | Tú |
| P13 | ¿Las entidades tienen tasas distintas? | Usan la misma tabla del pptx; cada entidad puede tener tabla propia (vacía = hereda) 🟡 | Director |
| P14 | Aviso de privacidad y plazos de retención de datos | Sin definir ❓ | Legal |

---

# PARTE B — PARA CLAUDE CODE

## 8. Stack y costos

### 8.1 Stack recomendado (opinión, no hecho)

- **Web:** Next.js (App Router) + TypeScript, responsivo y usable desde el celular.
- **Base de datos y auth:** Supabase (Postgres + Auth + Storage + Row Level Security).
- **Dinero:** `decimal.js` en código y `numeric` en Postgres. **Nunca flotantes.**
- **Validación:** Zod.
- **Pruebas:** Vitest, con pruebas de oro (sección 15).
- **PDF:** `@react-pdf/renderer`. **Excel de exportación:** `exceljs`.
- **Idioma:** español de México. Moneda MXN con separador de miles. Fechas `DD/MM/AAAA`.

Nada propietario: todo es Postgres estándar y código portable, para poder mudarse si algún día se escala.

### 8.2 Costos: lo que verifiqué y lo que no

**Desarrollo con datos sintéticos: $0.** Local + capa gratuita de Supabase.

**Supabase, plan Free** (documentación oficial):
- 500 MB de base de datos y 1 GB de almacenamiento.
- Los proyectos se pausan tras 1 semana sin actividad.
- Máximo 2 proyectos activos.
- **No incluye respaldos automáticos.**
- El plan Pro cuesta desde $25/mes e incluye respaldos diarios con 7 días de retención.

**Hosting:**
- ⛔ **Vercel Hobby no sirve.** Sus términos lo limitan a uso personal no comercial. Definen "comercial" como cualquier despliegue hecho para beneficio económico de cualquier persona involucrada en producirlo, **incluido un empleado pagado que escribe el código**. Mi lectura es que "uso interno" no lo excluye. No es dictamen legal.
- ❓ **Netlify:** una fuente de terceros sin fecha dice que su plan gratuito permite uso comercial. **No lo he confirmado en sus términos oficiales.**
- ❓ **Cloudflare:** existe plan gratuito de Workers y Pages. **No pude confirmar sus términos de uso comercial.**
- **Decisión pendiente:** confirmar términos oficiales antes del primer despliegue.

**Agente IA:** la API de Claude se cobra por uso y **no encontré un nivel gratuito permanente**. Por eso el agente es la fase final y el sistema funciona completo sin él. Con Claude Haiku 4.5, fuentes de terceros reportan $1 por millón de tokens de entrada y $5 por millón de salida. **No lo he confirmado en la página oficial de precios.**

### 8.3 Plan $0 con riesgos aceptados a propósito

| Riesgo en plan gratuito | Mitigación a $0 | Riesgo que queda |
|---|---|---|
| Sin respaldos automáticos | Botón "Exportar respaldo" (SQL/CSV cifrado) y rutina semanal. Guardar la copia fuera de la app | Si te olvidas, pierdes lo de esa semana |
| Pausa por 7 días de inactividad | Con 3–4 usuarios diarios casi no ocurre. Se restaura desde el panel | Vacaciones largas |
| 1 GB de almacenamiento | Comprimir documentos al subir (imágenes ≤ 1600 px, PDF optimizado). **Estimación mía:** 3–5 MB por expediente, o sea unos 200–340 expedientes | Se llena |
| Datos personales reales en infraestructura gratuita | **Piloto con datos reales solo con autorización escrita de tu jefa o Cumplimiento** y con las cuentas a nombre de la organización | Responsabilidad |

**Disparadores para pasar a plan de pago:**
- Primer expediente real sin respaldo probado.
- Más de ~150 expedientes.
- Más de 4 usuarios.
- Cualquier rechazo de Cumplimiento.

## 9. Estructura del repositorio

```
/
├── BLUEPRINT.md                 <- este documento
├── CLAUDE.md                    <- reglas de la sección 16
├── seed/parametros_iniciales.json
├── public/logo-crediflexi.png   <- logo (assets/)
├── src/
│   ├── app/                     <- pantallas por módulo (M1..M10)
│   ├── domain/
│   │   ├── tasas/               <- motor de tasas (puro, sin UI)
│   │   ├── interes/             <- cálculos de interés
│   │   ├── comisiones/          <- metas, desbloqueo, red, quincenas
│   │   └── kyc/                 <- validaciones (RFC, CURP, CLABE, vigencias)
│   ├── exports/                 <- layouts YUNIUS, PDF de propuesta
│   └── agent/                   <- herramientas del agente (fase final)
├── supabase/migrations/         <- esquema + políticas RLS
└── tests/                       <- pruebas de oro
```

**Regla:** `domain/` no importa nada de la interfaz ni de la base de datos. Así se puede probar con números reales sin levantar la app.

## 10. Modelo de datos

Todas las tablas llevan `id`, `creado_en`, `actualizado_en`, `creado_por`. Dinero en `numeric(14,2)`. Tasas en `numeric(9,6)` como fracción (0.165 = 16.5%).

**Organización**
- `organizaciones`, `sucursales(organizacion_id, nombre)`.
- `usuarios(auth_id, nombre, rol, sucursal_id, jefe_id, nivel_comision NULL, activo)`. Roles: `DIRECTOR_REGIONAL`, `GERENTE`, `EJECUTIVO`.
- `metas(usuario_id, mes, monto)` con historial.
- `entidades(clave, razon_social)`: `CREDIFLEXI`, `RAMI_SISE`.

**Parámetros versionados**
- `parametros(clave, valor jsonb, vigente_desde, vigente_hasta, cambiado_por, motivo)`. Nunca se sobrescribe, se inserta versión nueva.
- `tablas_tasas(entidad_id NULL, moneda, version, vigente_desde, limite_inferior_inclusivo bool)`.
- `tasas_tramos(tabla_id, desde, hasta NULL, esquema 'MENSUAL'|'FINAL', plazo_meses, tasa, estatus)`. `estatus`: `CONFIRMADA`, `SEGUN_USUARIO`, `POR_CONFIRMAR`.
- `tablas_comision(nivel 'N1'|'N2'|'N3', tipo 'NUEVO'|'RENOVACION', desde, hasta, plazo_meses, porcentaje)`.
- `tasas_competencia(nombre, tasa, fecha_captura, fuente)`.

**Comercial**
- `prospectos(ejecutivo_id, nombre, telefono, correo, estatus, comentarios, proximo_seguimiento, origen)`. Estatus: `CIERRE`, `INTERESADO`, `INTERMITENTE`, `NO_INTERESADO`.
- `contactos(prospecto_id, fecha, canal, nota)`.
- `plan_semanal_bloques(usuario_id, fecha, hora, donde, que, listo)`.
- `proyecciones(usuario_id, fecha, prospecto_id, monto, prob_cierre)`.
- `cotizaciones(usuario_id, prospecto_id, entidad_id, moneda, esquema, monto, plazo, tasa_usada, **snapshot jsonb del cálculo**, confirmada_en, pdf_path)`.

**Inversionistas**
- `inversionistas(entidad_id, tipo_persona, datos cifrados por campo, ejecutivo_id, estado_expediente)`.
- `beneficiarios(inversionista_id, parentesco, datos)`, máximo 2.
- `expediente_items(inversionista_id, tipo_documento, archivo_path, fecha_emision, valido_hasta, estado)`.
- `pep_datos(inversionista_id, dependencia, puesto, otro_puesto, fecha_inicio, fecha_fin)`.
- `regresos(inversionista_id, fecha, motivo, campo_afectado, resuelto)`. **Alimenta las reglas nuevas.**

**Inversiones**
- `inversiones(inversionista_id, entidad_id, captador_id, origen 'EJECUTIVO'|'EXTERNO', externo_id NULL, tipo 'NUEVA'|'INCREMENTO'|'RENOVACION', monto, plazo, esquema, tasa_contratada, medio 'EFECTIVO'|'TRANSFERENCIA', fecha_contrato, fecha_deposito, fecha_captacion, estado)`. **La tasa contratada queda congelada.**
- `calendario_pagos(inversion_id, fecha, monto, estado)`.

**Comisiones**
- `comisiones_lineas(inversion_id, beneficiario_id, rol_en_linea 'CAPTADOR'|'RED', nivel, base, porcentaje, monto, periodo_quincena, estado)`. Estados: `DEVENGADA_BLOQUEADA` → `DESBLOQUEADA` → `PAGADA` | `PERDIDA`.
- `periodos(mes, quincena, corte_fecha, cerrado)`.

**Red**
- `externos(registrado_por, datos, nivel, estado)` con sus documentos de alta.

**Sistema**
- `bitacora(usuario_id, accion, entidad, entidad_id, campos_modificados, momento)`. **Solo inserción.** Nunca guarda valores de datos personales, solo nombres de campos.
- `notificaciones(usuario_id, tipo, mensaje, programada_para, leida)`.

## 11. Reglas de negocio

### 11.1 Motor de tasas (puro)

```
tasa(entidad, moneda, esquema, monto, plazo, fecha):
    tabla = tabla_vigente(entidad, moneda, fecha)  or  tabla_vigente(NULL, moneda, fecha)   # hereda
    tramo = el tramo de mayor "desde" tal que monto >= desde        # inclusivo si tabla.limite_inferior_inclusivo
    si tramo.estatus == POR_CONFIRMAR   -> error BLOQUEA_COTIZACION
    si plazo no existe en tramo/esquema -> error PLAZO_NO_DISPONIBLE
    return tramo.tasa
```

- Ninguna tasa se escribe en el código.
- `interes_mensual = monto × tasa ÷ 12`; `interes_total = monto × tasa × plazo ÷ 12`. Sin capitalizar.
- **Siempre mostrar el desglose** antes de confirmar (ver 11.2).

### 11.2 Cotizador con vista previa obligatoria ✅

1. Se eligen entidad, moneda, esquema, monto y plazo.
2. **Vista previa:** tramo aplicado, tasa, fórmula con números, pago mensual o total, fecha de inicio, fecha de término y fechas de pago.
3. Botón **"Confirmo que los números son correctos"**. Sin eso no se genera el PDF.
4. El PDF guarda el snapshot del cálculo y **la fecha de las tasas**. Los comparativos con la competencia imprimen su fecha y fuente.
5. Si `estatus = POR_CONFIRMAR`, el cotizador se detiene y explica por qué.

### 11.3 Comisiones y metas

```
captacion_mes(usuario) = suma(inversiones NUEVAS + INCREMENTOS de su captación propia y de su red)
                         en el mes, por fecha_captacion        # renovaciones excluidas (editable)
umbral(usuario)        = 0.80 × meta(usuario, mes)             # editable
desbloqueada           = captacion_mes >= umbral
comision_linea         = monto × tabla_comision[nivel][tipo][tramo][plazo]
propia                 -> 100 %  al captador
red externa            -> 30 %   (base: tabla de quien capta, editable)
```

- **Corte de quincena:** las líneas `DESBLOQUEADAS` que aún no se pagan pasan a `PAGADA` y se asignan a ese periodo.
- **Cierre de mes** por debajo del umbral: las `BLOQUEADAS` pasan a `PERDIDA` (editable).
- **Tablero:** siempre tres cifras visibles: comisión bloqueada, comisión desbloqueada y **"lo que hoy no cobras"**. Además, falta para 80% y 100%.
- **Simulador:** "si cierro X a N meses, ¿cuánto cobro y cuánto me falta?". No escribe datos.
- Usuario **sin nivel** asignado: el tablero muestra "asigna tu nivel" y no inventa números.

### 11.4 Pipeline y plan semanal

- Cuatro estatus con color: `CIERRE` azul, `INTERESADO` verde, `INTERMITENTE` amarillo, `NO_INTERESADO` rojo.
- Recordatorios automáticos de seguimiento: **intermitente** en 1 a 2 meses y **no interesado** en 5 a 6 meses (del manual). Editables.
- **Importación de pipeline:** cada quien sube su Excel del último mes. Columnas esperadas: `NOMBRE`, `CONTACTO`, `COMENTARIOS`, `ESTATUS`, `SEGUIMIENTO`, `EJECUTIVO`.
  - Normalizar espacios y mayúsculas (el archivo de ejemplo trae `"CIERRE "` con espacio).
  - Teléfono a 10 dígitos.
  - Detectar duplicados por teléfono.
  - **Vista previa antes de confirmar** y opción de deshacer la importación completa.
- **Plan semanal:** rejilla hora × día. Campos por bloque: dónde (`SUCURSAL`, `CAMPO`, `COMIDA`), qué (`GESTION CARTERA`, `CARTA INVITACION`) y casilla "Listo".
- **Proyección:** fecha, ejecutivo, monto, % de cierre, inversionista. Muestra **total bruto y total ponderado**. Con los datos del archivo de ejemplo: bruto $1,300,000 y ponderado **$527,500**.
- **Reporte del viernes 11:00:** se genera en el formato de los Excel actuales. Aviso previo el jueves o viernes temprano.

### 11.5 Avisos

- Dentro de la app y por correo.
- Enlace "abrir WhatsApp con mensaje prellenado" (el ejecutivo lo envía; no hay envío automático).
- Archivo de calendario `.ics`.
- El proveedor de correo queda por elegir y verificar costo.

## 12. Alta y KYC guiado ⛔ máxima prioridad de calidad

### 12.1 Pasos del asistente

1. **Tipo de persona** (física o moral) y **entidad** (Crediflexi o Rami Sise).
2. **Datos** (campos del layout de YUNIUS, abajo).
3. **Documentos** con semáforo.
4. **Beneficiarios** (hasta 2).
5. **Persona políticamente expuesta:** pregunta sí/no. Si es sí, se abren dependencia, puesto, otro puesto, fecha inicio y fecha término.
6. **Condiciones de la inversión:** monto, plazo, tasa (del cotizador confirmado), tipo de interés, medio (efectivo o transferencia), parentesco del beneficiario y fecha de contrato.
7. **Revisión final ("pre-vuelo"):** lista de todo lo que falta o está sospechoso. **El botón de exportar permanece deshabilitado hasta que todo esté en verde.**

### 12.2 Datos del inversionista (layout de alta de fondeadores)

Nombre, sexo, fecha de nacimiento, entidad de nacimiento, estado civil, régimen marital (solo si es casado), escolaridad, número de dependientes, domicilio, teléfono, correo electrónico, actividad económica (giro, o si es empleado, privado o público).

### 12.3 Documentos (checklist configurable)

- Del inversionista: INE (ambos lados) o pasaporte, comprobante de domicilio, constancia de situación fiscal, estado de cuenta bancario.
- Antigüedad máxima de **3 meses** para comprobante de domicilio y estado de cuenta.
- Formato KYC (listas negras, boletinados, PLD). ❓ Plantilla pendiente.
- Beneficiarios: ❓ ver P11.

### 12.4 Validaciones

| Validación | Detalle |
|---|---|
| Vigencia de documentos | Calcula `valido_hasta` desde la fecha de emisión y avisa antes de vencer |
| Formato de RFC y CURP | Estructura y **coherencia con nombre, fecha de nacimiento y sexo**. Rechaza si no coinciden |
| CLABE | Longitud (18) y **dígito verificador** |
| Edad | **Se calcula, nunca se captura.** El layout de ejemplo trae una edad fija que no coincide con su fecha de nacimiento |
| Duplicados | Mismo RFC, CURP, teléfono o correo |
| Textos | Normalización: mayúsculas, espacios y acentos consistentes |
| Coherencia | Persona moral con documentos de persona moral, beneficiarios ≤ 2, campos condicionales |
| Legibilidad | Advertencia si la imagen del INE está borrosa o cortada (heurística) |

### 12.5 Exportación ✅

- Excel con **exactamente** las columnas de `LAYOUT_INVERSIONISTAS.xlsx`, en el mismo orden.
- Antes de confiar en él: **prueba de carga real en YUNIUS** con datos sintéticos o autorizados.
- Formato de características de inversión (campos de `CARACTERISTICAS_DE_INVERSION.xlsx`): inversor, ejecutivo, gerente, gerente ejecutivo, monto, plazo, tasa anual, medio, parentesco del beneficiario, fecha de contrato, razón social (Crediflexi o Rami Sise), tipo de persona, tipo de interés e indicaciones.
- Carátula del contrato (campos del Anexo 01 de los machotes): prestamista, prestatario, fecha, número de anexo, cantidad, tasa ordinaria fija anual, día de pago de intereses, plazo, datos bancarios, correo para estado de cuenta y contacto de aclaraciones.
  **El texto legal del contrato no se edita en la app.** Solo se llena la carátula. Cualquier cambio al machote lo aprueba Legal.

### 12.6 Bitácora de regresos

Cada vez que te regresen algo: motivo, campo afectado y cuándo. Se acumula para convertirlo en validación. **Esto es lo que más sube la calidad con el tiempo.**

### 12.7 Alta de externos

- Checklist propio (usa `ALTA_DE_USUARIO_EN_YUNIUS.xlsx` y `FORMATO_LAYOUT_DATOS.xlsx`). ❓ Falta confirmar cuál aplica a cada caso.
- `FORMATO_LAYOUT_DATOS.xlsx` incluye datos de nómina y bancarios (IMSS, cuenta, CLABE y tarjeta). **No almacenar número de tarjeta.** La CLABE basta para pagar. Confirmar con Administración si realmente hace falta.
- La producción del externo aparece en "Mi red" y suma a la meta de su responsable.

## 13. Seguridad y privacidad (desde el día 1)

- **MFA obligatoria** para todos los usuarios.
- **Row Level Security** en todas las tablas, por organización, sucursal, rol y cadena de mando. Cada usuario ve solo lo suyo y lo de su red hacia abajo.
- **Documentos** en almacenamiento privado, con enlaces firmados de corta duración. Nunca URLs públicas.
- **Cifrado por campo** para CURP, RFC, CLABE y cuenta. Las claves no viven en el repositorio.
- **Bitácora** de quién vio o descargó cada expediente. Solo inserción.
- Secretos solo del lado del servidor. Sin claves en el navegador.
- Sesiones con caducidad, bloqueo por intentos y cabeceras de seguridad (CSP, HSTS).
- **Nada de datos personales en logs, errores ni mensajes al agente.**
- **Desarrollo y pruebas con datos sintéticos.** Los archivos reales que compartiste (layout de datos, alta de usuario) traen RFC, CURP, IMSS, cuenta, CLABE y tarjeta: **nunca se suben al repositorio ni a chats**.
- Cuentas de hosting y base de datos **a nombre de la organización**, no de una cuenta personal.
- Retención, aviso de privacidad y derechos del titular: **los define Legal o Cumplimiento** (P14). No puedo confirmar qué exige la ley en este caso.

## 14. Agente IA (fase final, opcional)

**Alcance:** comercial (citas, objeciones, seguimientos), administrativo (checklists, recordatorios, reportes) y estratégico (priorizar prospectos, escenarios de meta y bono, análisis de pipeline).

**Herramientas (funciones que llama, nunca de memoria):**
`buscar_documentos`, `cotizar` (usa el motor real), `estado_meta`, `simular_cierre`, `listar_pipeline`, `checklist_expediente`, `resumen_semana`, `redactar_borrador` (solo borradores).

**Reglas:**
1. Opera **con los mismos permisos** del usuario. Si tú no ves algo, el agente tampoco.
2. **Tasas y cálculos: siempre del motor.** Nunca inventa ni recuerda cifras.
3. Responde con documentos aprobados y **cita la fuente**. Si no la tiene, dice "No puedo confirmar esto".
4. **No promete rendimientos, garantías ni "sin comisiones" con palabras propias.** Usa textos aprobados por Cumplimiento.
5. No envía ni modifica nada sin confirmación del usuario. Todo queda en bitácora.
6. Presupuesto mensual tope por usuario y modelo económico por defecto.
7. No recibe datos personales sensibles. Se enmascaran antes de enviarse.

## 15. Fases, criterio de "listo" y pruebas de oro

| Fase | Contenido | "Listo" cuando… |
|---|---|---|
| **0** | Repositorio, Supabase, login con MFA, roles, sucursales, bitácora, logo, semilla | Un usuario de cada rol entra y solo ve lo suyo |
| **1** | M2 + M3: tasas, cotizador, vista previa, PDF | Las pruebas de oro de abajo pasan |
| **2** | M4 + M9 + M5 + M8: alta/KYC, documentos, inversiones, externos, exportación | Un alta sintética completa se exporta y carga bien |
| **3** | M6 + M7: metas, comisiones, pipeline, plan semanal, reporte | El ejemplo 6.3 da exactamente $25,584 |
| **4** | M10: agente | Responde con cita y se niega a inventar |

### Pruebas de oro (obligatorias antes de dar una fase por buena)

1. **Tabla del pptx:** para cada celda de los 13 montos de `TABLA_RENDIMIENTOS_EJEMPLOS.pptx`, el motor debe coincidir con pago mensual y ganancia. **Excepción documentada:** las 10 cifras de la lámina 8 ($800,000) están copiadas de la lámina de $700,000. El motor debe dar los valores correctos (12,000.00 / 148,000.00 / 12,333.33 / 228,000.00 / 12,666.67 / 312,000.00 / 13,000.00 y, para final de plazo, 164,000.00 / 252,000.00 / 344,000.00) y la prueba debe **marcar** la diferencia, no ocultarla.
2. **Ejemplo oficial** (`EJEMPLOS_CFPI.pdf`): $1,500,000, 12 meses, 19% → interés mensual **$23,750.00** e interés total **$285,000.00**.
3. **Comisión:** ejemplo 6.3 con N1 (6,600.00 / 10,824.00 / 8,160.00 / total 25,584.00).
4. **Desbloqueo:** a 79.99% sigue bloqueada, a 80.00% se desbloquea.
5. **Límites de tramo:** $199,999.99, $200,000.00 y $200,000.01 producen lo que define la tabla activa. Con `POR_CONFIRMAR`, bloquea.
6. **RFC/CURP/CLABE:** casos buenos y malos sintéticos.
7. **Seguridad:** un ejecutivo nunca lee datos de otro ejecutivo (prueba automática de RLS).

## 16. Reglas de trabajo para Claude Code (copiar a `CLAUDE.md`)

1. Lee este blueprint y `seed/parametros_iniciales.json` antes de escribir código.
2. **No inventes reglas.** Si algo está en ❓ o ⛔, constrúyelo como parámetro editable y pregunta.
3. Dinero con `decimal.js` y `numeric`. Nunca `number` para montos o tasas.
4. Ninguna tasa, porcentaje o umbral vive en el código: todo sale de parámetros versionados.
5. Escribe primero la prueba de oro y luego la función.
6. Nunca uses, pegues ni generes datos personales reales. Solo sintéticos.
7. Cada pantalla que calcula dinero muestra el desglose.
8. Todo cambio de parámetro pasa por la bitácora.
9. Mensajes de error en español claro: qué falló y qué hacer.
10. Antes de declarar una fase terminada, corre todas las pruebas de oro y reporta cuáles pasan.

**Prompt inicial sugerido:**
> "Lee BLUEPRINT.md y seed/parametros_iniciales.json. Empieza por la Fase 0: crea el proyecto Next.js + TypeScript, el esquema de Supabase con RLS para los roles y sucursales, el login con MFA, la bitácora y la carga de la semilla. No avances a la Fase 1 hasta mostrarme las pruebas del 7 (RLS) pasando."

---

# ANEXOS

## Anexo A — Discrepancias abiertas (ninguna se resuelve sola)

| # | Qué pasa | Dónde se ve | Decisión |
|---|---|---|---|
| D1 | **Límites de tramo:** el pptx trata `Desde` como inclusivo ($200,000 → 16.5%). El Excel y el folleto dicen "200,001 en adelante", o sea que $200,000 → 16.0% | `TABLA_RENDIMIENTOS_EJEMPLOS.pptx` vs `CREDIFLEXI_FPI_2026.pdf` y `Tasas_Interes...xlsx` | Interruptor por tabla. Arranca con pptx (inclusivo). El Director confirma |
| D2 | **Tramo $30,000–$199,999:** el pptx da 20%–21.5% (mensual) y 22%–23.5% (final). El Excel y el folleto dan 16%–17.5% y 18%–19.5%. Además, una tasa que baja al subir el monto contradice el manual ("a mayor plazo y monto, mayor tasa") | Igual | ⛔ Bloquea cotizar montos < $200,000 hasta confirmar |
| D3 | **$2,000,000:** 6 y 12 meses aparecen N/A, pero $4,200,000 sí los ofrece. El plazo de 36 meses solo aparece en $2M | pptx, láminas 12 y 13 | Confirmar plazos disponibles para montos altos |
| D4 | **Lámina 8 ($800,000):** 10 cifras repetidas de la lámina de $700,000 | pptx | Corregir el pptx. El motor usa los valores calculados |
| D5 | **24% escrito a mano** en la columna "SIMULADOR" de la calculadora. No existe en ninguna tabla | `CALCULADORA...xlsx`, `Calculadora!E12` | Se elimina. La app no hardcodea tasas |
| D6 | **Contrato machote:** 20% a 24 meses con $30,000. Ninguna tabla lo da | `CONTRATO_MACHOTE_*.pdf` | Probable ejemplo. Confirmar |
| D7 | **Tabla N3 nuevos:** una celda (6 meses, primer tramo) no sigue el 70% de N1 | `Bono_Quincenal...` | Confirmar si es intencional |
| D8 | **Documentos del beneficiario:** manual e imagen de requisitos no coinciden | Manual vs `REQUISITOS_FONDEADORES.jpg` | Confirmar con Cumplimiento |
| D9 | **Calculadora, "Mercado Pago":** usa 25,000 fijo en las fórmulas (justificado en una nota, pero solo vale para ese monto) | `Calculadora!J15:J16` | La app parametriza topes por competidor |
| D10 | **Edad capturada a mano** en el layout de datos, no coincide con la fecha de nacimiento | `FORMATO_LAYOUT_DATOS.xlsx` | La edad se calcula |
| D11 | **Nombre del archivo vs contenido:** el plan semanal se llama "09 al 13 de marzo" pero trae la semana del 22 al 26 de junio | `PLAN_Y_PROYECCION...xlsx` | La app fecha cada plan de forma automática |
| D12 | **Salario mínimo 2025** en los supuestos del bono; ya estamos en 2026 | `Bono_Quincenal...` | Confirmar si aún se usa y para qué |

## Anexo B — De dónde sale cada cosa

| Módulo | Archivos fuente |
|---|---|
| M2 tasas y cotizador | `TABLA_RENDIMIENTOS_EJEMPLOS.pptx`, `Tasas_Interes_Pesos_y_Dolares_2026.xlsx`, `CALCULADORA_DE_INVERSIONES_NUEVAS_TASAS.xlsx`, `SIMULADOR_CRECIENTE_-_NUEVAS_TASAS.xlsm`, `EJEMPLOS_CFPI.pdf` |
| M3 propuestas | `CREDIFLEXI_FPI_2026.*`, `Flyer_*`, `FLYER_COMPARATIVO_*` (solo como referencia de contenido) |
| M4/M5 alta e inversión | `LAYOUT_INVERSIONISTAS.xlsx`, `REQUISITOS_FONDEADORES.jpg`, `CARACTERISTICAS_DE_INVERSION.xlsx`, `MANUAL_DE_CAPACITACION_INVERSIONES.pdf`, `CONTRATO_MACHOTE_*.pdf` |
| M6 comisiones | `Bono_Quincenal_Equipo_Inversiones_V18_2a_Gen.xlsx`, `PROPUESTA_INCENTIVOS_EXTERNOS-INTERNOS_EJECUTIVOS.xlsx` |
| M7 pipeline y plan | `PIPELINE.xlsx`, `PLAN_Y_PROYECCION_SEMANAL...xlsx`, manual |
| M8 externos | `ALTA_DE_USUARIO_EN_YUNIUS.xlsx`, `FORMATO_LAYOUT_DATOS.xlsx` |
| Cumplimiento (referencia) | `CNBV_DetalleEntidad_2.pdf`, `CSF-*`, `Opinion_*` |

**Hechos de las entidades (según los archivos):**
- **Rami Sise, S.A.P.I. de C.V., SOFOM, E.N.R.** aparece en el registro de la CNBV (22-jul-2026) y el folleto dice que opera bajo la marca Crediflexi.
- **Crediflexi, S.A.P.I. de C.V.** tiene su propia constancia de situación fiscal y opinión de cumplimiento positiva (22-jul-2026).
- Son **dos entidades legales** con contratos distintos.
- Los documentos dicen SOFOM E.N.R. (Entidad No Regulada). Una imagen del Project explica que, en ese caso, la CNBV supervisa en materia de lavado de dinero y prevención de fraudes. El material comercial dice además "supervisada por CNBV, CONDUSEF y SHCP". **Esa redacción conviene que la revise Cumplimiento. Es una observación, no una conclusión legal.**

## Anexo C — Glosario

| Término | Significa |
|---|---|
| **Fondeador / inversionista** | Quien presta su dinero a la entidad a cambio de intereses |
| **Captación** | Dinero nuevo que entra de inversionistas |
| **Incremento de capital** | El inversionista agrega dinero a una inversión existente |
| **Renovación** | El inversionista vuelve a invertir al vencer su plazo |
| **Tramo** | Rango de monto con su propia tasa |
| **Pipeline** | Lista de prospectos con su estatus de avance |
| **KYC** | "Conoce a tu cliente": verificación de identidad y datos |
| **PLD** | Prevención de lavado de dinero |
| **PEP** | Persona políticamente expuesta |
| **CLABE** | Cuenta bancaria de 18 dígitos para transferencias |
| **RLS** | Seguridad a nivel de fila: la base de datos misma impide ver datos ajenos |
| **Snapshot** | Copia congelada del cálculo con los datos del momento |
| **N1 / N2 / N3** | Niveles de comisión. Quién cae en cada uno está por definir (P4) |

## Anexo D — Fuentes verificadas (entidad, título, fecha, enlace)

- Vercel, "Fair Use Guidelines" (definición de uso comercial), sin fecha visible en esta versión. https://vercel.com/docs/platform/fair-use-policy
- Supabase, "Pricing" (límites del plan Free, respaldos, plan Pro), sin fecha visible. https://supabase.com/docs/pricing y https://Supabase.io/pricing
- ToolFreebie (tercero, **no verificado con fuente oficial**), comparativa de hosting gratuito, sin fecha visible. https://toolfreebie.com/?p=39
- Cloudflare, "Workers Pricing", actualizado 27-ago-2026. https://6e8c1c3a.previews.developers.cloudflare.com/workers/platform/pricing/index.md
- G2 (tercero, **no verificado con fuente oficial**), "Claude API Pricing", sin fecha visible. https://www.g2.com/articles/claude-api-pricing
- EvoLink (tercero), "Claude API Pricing Guide 2026", 9-abr-2026. https://evolink.ai/blog/claude-api-pricing-guide-2026

Todas las cifras de archivos internos (tasas, comisiones, incentivos, ejemplos) se leyeron de los archivos originales. Las cifras de interés y comisión de los ejemplos se recalcularon con la fórmula indicada.
