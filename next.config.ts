import type { NextConfig } from "next";

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
