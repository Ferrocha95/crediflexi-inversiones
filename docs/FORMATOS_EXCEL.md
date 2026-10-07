# Formatos de Excel que la app debe producir

Leídos por código de los archivos reales (octubre 2026). **No contiene datos de personas.** Los Excel originales NO van al repositorio: se quedan en la computadora de Fernando (el `.gitignore` ya excluye `*.xlsx`).

Dos archivos se mandan por correo cada viernes por la mañana:

| Archivo | Contenido | Nombre |
|---|---|---|
| Pipeline | Prospectos de la semana que termina | `PIPELINE_{MES}.xlsx` (ej. `PIPELINE_OCTUBRE.xlsx`) |
| Plan y proyección | Planeación y proyección de la SIGUIENTE semana (2 hojas) | `PLAN_Y_PROYECCION_SEMANAL_DEL_{d1}_AL_{d2}_DE_{MES}_DEL_{año}.xlsx` |

Imagen de encabezado (la misma en ambos): `public/logo-encabezado-excel.png` (2046 × 1151, **con transparencia**; logo blanco con "FONDO DE INVERSIÓN PRIVADO"; solo se ve bien sobre el azul #012553).

## 1. Pipeline — hoja `PROSPECTOS SUCURSAL`

La app lo genera con `src/servidor/excel/pipeline.ts` (`exportarPipeline`) y lo descarga en `GET /pipeline/excel?semana=AAAA-MM-DD&ejecutivo=<id>`.

- **Qué filas lleva:** todos los prospectos **activos** del ejecutivo (supuesto D1 aprobado en el plan del Sprint 2b). La semana elegida solo cambia el rango de `D1:F2` y el mes del nombre del archivo. Antes este documento decía "los de la semana que se reporta"; se corrigió.
- **Un ejecutivo por archivo.** `C2` lleva un solo nombre: un ejecutivo descarga lo suyo y un superior elige a un ejecutivo de su equipo.
- **Nombre del archivo:** `PIPELINE_{MES}.xlsx`, con el mes del viernes de la semana (una semana del 28 de septiembre al 2 de octubre da `PIPELINE_OCTUBRE.xlsx`).
- Anchos de columna (caracteres): A 49.1 · B 19.1 · C 114.0 · D 19.4 · E 17.7 · F 29.0.
- **Filas 1 y 2** (alto 64.5 y 60.0): fondo **#012553** en A–F.
  - `A1:B2` combinadas, con la imagen anclada en ese rango.
  - `C1` = " PIPELINE INVERSIONES" (con el espacio inicial): Arial 30, blanco, centrado.
  - `C2` = nombre del ejecutivo en MAYÚSCULAS: Arial 24, blanco.
  - `D1:F2` combinadas = rango de la semana en texto (ej. "28 DE SEPTIEMBRE A 2 DE OCTUBRE 2026"): Arial 30, blanco, centrado.
- **Fila 3**, encabezados con fondo **#DAE9F8**: NOMBRE · CONTACTO · COMENTARIOS · ESTATUS · SEGUIMIENTO · EJECUTIVO.
- **La fila 3 y todas las filas de datos** van en Arial 12 **negrita**, color **#012653** (no negro), con bordes finos.
- **Filas de datos desde la 4:**
  - NOMBRE y EJECUTIVO en MAYÚSCULAS;
  - CONTACTO como número, con formato General (si empezara con 0 se escribe como texto para no perder el cero);
  - COMENTARIOS con ajuste de texto y alineado a la izquierda;
  - ESTATUS con espacio ("NO INTERESADO");
  - SEGUIMIENTO como fecha con formato `D/M/YYYY`, escrita como fecha en UTC para que el día no se mueva.
- **Toda la fila (A–F) se pinta según el estatus. Son tres colores:**

| ESTATUS (texto exacto) | Color de la fila |
|---|---|
| INTERESADO | **#A8D08D** (verde) |
| INTERMITENTE | **#FFD965** (amarillo) |
| NO INTERESADO | **#F4B083** (naranja) |

- **Textos que empiezan con =, +, - o @** (por ejemplo, un nombre "=HYPERLINK(…)" o un comentario "- llamar"): se escriben como celdas de **texto**, nunca como fórmula, y el texto visible no cambia. No llevan el apóstrofo oculto de Excel (`quotePrefix`): exceljs 4.4.0 no lo soporta. Son inertes al abrir el archivo, pero si alguien edita la celda en Excel, Excel puede convertirla en fórmula (ver `PENDIENTES_TECNICOS.md`).

### Importar el pipeline

La app lee un `.xlsx` en `POST /pipeline/importar` (`src/servidor/excel/importar.ts`), muestra una vista previa y solo guarda al confirmar (acción `confirmarImportacion`, que vuelve a validar todo).

- **Archivo:**
  - extensión `.xlsx` y firma ZIP;
  - 5 MB como máximo (content-length y bytes reales);
  - sin `xl/vbaProject.bin` (macros);
  - 50 MB como máximo descomprimido, según lo que declara el índice del ZIP;
  - 2,000 filas como máximo.
- **Hoja y encabezados:** se lee la hoja `PROSPECTOS SUCURSAL` (o la primera). La fila de encabezados se busca por su texto, en cualquier fila y orden; son obligatorias NOMBRE, CONTACTO y ESTATUS.
- **Fórmulas:** nunca se evalúan. Una fila con una celda de fórmula se rechaza ("la celda C7 tiene una fórmula"). Un texto que empieza con =, +, - o @ no es fórmula: se importa como texto.
- **Normalización** (las mismas reglas de la pantalla):
  - estatus con espacios de más o en minúsculas;
  - teléfono guardado como número, con guiones, espacios o +52;
  - seguimiento como fecha, número de serie de Excel o texto `D/M/AAAA`;
  - el nombre se queda tal cual (también en mayúsculas).
- **Ejecutivo:** cada fila queda a nombre de quien importa. Si venía vacía o con otro nombre, se reporta como corregida.
- **Reporte, una línea por fila:**
  - "se importa", con sus correcciones;
  - "se importa con aviso": seguimiento de otro año o de hace más de 60 días, o teléfono repetido contra los activos visibles o dentro del archivo;
  - "no se importa", con el motivo (incluido el guardia de CLABE, RFC o CURP).
- **Confirmar:** inserta todo en una sola operación. Si una fila falla, no se inserta ninguna y se dice cuál.

## 2. Plan y proyección

### Hoja `PLANEACIÓN SEMANAL`

- Alto de filas: 1 → 81 · 2 → 46.5 · 3 → 15.75 · 4 a 6 → 27 · de la 7 en adelante → 21.
- Encabezado, fondo **#012553**: `A1:F2` imagen · `G1:M1` título, Arial 22 blanco: "PLANEACIÓN SEMANAL DEL 6 DE OCTUBRE AL 10 DE OCTUBRE DEL 2026" · `G2:M2` "EJECUTIVO: {NOMBRE}".
- Fila 4: días en celdas combinadas de dos columnas, fondo #012553: LUN `D4:E4` · MAR `F4:G4` · MIÉ `H4:I4` · JUE `J4:K4` · VIE `L4:M4`.
- Fila 5: la fecha de cada día (combinadas igual), fondo **#DAE9F8**, formato `D/M/YYYY`.
- Fila 6: por cada día, dos columnas: "¿DÓNDE?" y "QUÉ", fondo **#0E396D**. En A6 "HORA ".
- Filas 7 a 16: horas 9:00 a 18:00 (columna A, formato `h:mm`). Celdas con fondo **#E6E6E6**, Arial 11, centradas, bordes finos.
- Catálogos vistos: ¿DÓNDE? = SUCURSAL · CAMPO · COMIDA. QUÉ = GESTION CARTERA · CARTA INVITACION · COMIDA · LLAMADAS · y texto libre (ej. "CITA CON {persona}", ligado a un prospecto).
- Fila 24 (`A24:M24` combinadas), nota fija: "NOTA: POSIBLES CITAS EN EL TRANSCURSO DE LA SEMANA, SE NOTIFICARÁ A GERENCIA Y SE EDITARÁ ESTE PLAN SEMANAL".
- **Solo lunes a viernes** (confirmado por Fernando). Cada día tiene dos columnas: ¿DÓNDE? y QUÉ. **No se usan** las columnas laterales "dom" y "sáb" ni sus "Quién" y "Listo" del original: en la exportación no aparecen y las columnas de los días se recorren a la izquierda (A = HORA, luego LUN a VIE de dos columnas cada uno). Si un día se quiere marcar una actividad como hecha, es una función de la app que NO se exporta.
- En el original las fechas se calculan con `HOY()` y un nombre definido `Primer_Día`; en la exportación van como valores fijos.

### Hoja `PROYECCIÓN SEMANAL`

- Anchos: A 19.6 · B 18.9 · C 14.9 · D estándar · E 23.1. Alto de filas: 1 → 75.75 · 2 → 23.25 · 3 → 7.5 (separador) · 4 en adelante → 16.5.
- `A1:E1` combinadas, fondo **#012553**, con la imagen de encabezado. `A2:E2` combinadas, "PROYECCIÓN SEMANAL", fondo **#DAE9F8**, Arial 11, texto **#012553**.
- Fila 4, encabezados, fondo **#0E396D**: FECHA · EJECUTIVO · CANTIDAD · % CIERRE · INVERSIONISTA.
- Datos desde la fila 5, como tabla de Excel (`Tabla2`, estilo con filas alternadas en gris). Formatos: FECHA `D/M/YYYY` · CANTIDAD moneda `[$$-80A] #,##0.00` · % CIERRE `0%`.
- Total en `C13`: `=SUM(Tabla2[CANTIDAD])`, con borde fino. **Es la suma simple, sin ponderar por el % de cierre.**
- Los nombres de inversionista de la proyección corresponden a prospectos del pipeline.

## 3. Reglas de datos que conviene imponer en la app

Problemas vistos en el pipeline real (17 filas):
- Estatus con espacio al final ("INTERMITENTE ") → la app guarda solo los tres valores exactos.
- 1 fila sin ejecutivo → ejecutivo obligatorio (se llena con quien inicia sesión).
- 1 fecha de SEGUIMIENTO con año 2025 en un pipeline de 2026 → avisar cuando la fecha sea anterior a hace más de 60 días o de otro año.
- Teléfono guardado como número → guardar como texto de 10 dígitos y mostrar con formato.

## 4. Semana

- El pipeline lleva todos los prospectos activos del ejecutivo; la semana (de lunes a viernes) solo define el encabezado y el mes del nombre del archivo.
- El encabezado del pipeline lleva el rango lunes a viernes de la semana que se reporta.
- El plan cubre lunes a viernes de la semana siguiente (en el ejemplo, del 6 al 10 de octubre).
- La app muestra, además, el total ponderado (CANTIDAD × % CIERRE). **No va en el Excel**, para no alterar el formato que se manda.
