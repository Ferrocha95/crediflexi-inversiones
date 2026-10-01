# Pendientes técnicos

- (a) Traducir los errores de BD a español en la app: mapa de código + restricción a mensaje, con pruebas unitarias.
- (b) MFA obligatoria en las políticas (aal2): otra migración. Sin verificar en la documentación oficial.
- (c) Convertir `validar_cadena_de_mando` a `security definer` antes de dar escritura a `authenticated`.
- (d) Rehacer las pruebas de escritura al abrir permisos: hoy pasan por ausencia de grants.
- (e) Bitácora de cambios (regla 8 de CLAUDE.md) antes de abrir escritura.
- (f) `seed.sql` con datos sintéticos.
- (g) `.gitattributes` para normalizar finales de línea.
- (h) ESLint 9.39.5 está descontinuado.
- (i) Pruebas pendientes: prueba de mutación de políticas, usuario sin jefe y jefe inactivo en la cadena.
- (j) Las mutaciones 5, 7, 8 y 9 dependen de una sola prueba cada una: agregar pruebas redundantes.
- (k) El manejador de SIGINT/SIGTERM de `scripts/mutacion.mjs` no se probó; en Windows, Node no recibe SIGTERM externo.
- (l) Las pruebas de escritura pasan en parte por ausencia de permisos: al abrir la escritura hay que redefinirlas (ya está en d) y añadir el caso de insertar con RETURNING.
- (m) `scripts/mutacion.mjs` escribe su bitácora en `C:\dev\informes`, fuera del repositorio.
