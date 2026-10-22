import type { NextConfig } from "next";
import { validarConfiguracionDeArranque } from "./src/servidor/supabase/config";

// HOSTS_PERMITIDOS o ENTORNO mal formadas hacen fallar next build, next start
// y next dev con un mensaje en español, en vez de abrir la app por accidente.
validarConfiguracionDeArranque();

const nextConfig: NextConfig = {
  experimental: {
    // El proxy guarda en memoria el cuerpo de cada petición hasta este tope y
    // RECORTA lo que pase (no lo rechaza). La importación del Excel acepta
    // hasta 5 MB y rechaza un cuerpo recortado (content-length distinto de lo
    // leído): ver src/app/(app)/pipeline/importar/route.ts.
    proxyClientMaxBodySize: "6mb",
  },
};

export default nextConfig;
