import type { NextConfig } from "next";
import { validarConfiguracionDeArranque } from "./src/servidor/supabase/config";

// HOSTS_PERMITIDOS o ENTORNO mal formadas hacen fallar next build, next start
// y next dev con un mensaje en español, en vez de abrir la app por accidente.
validarConfiguracionDeArranque();

const nextConfig: NextConfig = {
  experimental: {
    // El proxy guarda en memoria el cuerpo de cada petición hasta este tope y
    // RECORTA lo que pase (no lo rechaza). Las subidas más grandes caben: el
    // Excel (4 MiB) y la Biblioteca (4 MiB más 64 KiB del formulario). Las dos
    // rutas rechazan además un cuerpo recortado (content-length distinto de lo
    // leído). Vercel limita el cuerpo a 4.5 MB antes de llegar aquí.
    proxyClientMaxBodySize: "6mb",
  },
};

export default nextConfig;
