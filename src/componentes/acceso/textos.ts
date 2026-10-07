/**
 * Mensaje de sesión expirada. Lo usan el proxy (401 en texto), la ruta del
 * PDF (401 en JSON), la acción del cotizador y la pantalla. Vive aquí, y no en
 * src/aplicacion, porque también lo importan componentes de cliente.
 */
export const MENSAJE_SESION_EXPIRADA = "Tu sesión expiró; vuelve a iniciar sesión.";

export const TEXTO_VOLVER_A_ENTRAR = "Iniciar sesión otra vez";
