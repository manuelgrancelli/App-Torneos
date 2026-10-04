import type { NextConfig } from "next";

/**
 * Headers de seguridad para todas las respuestas (D-041). La CSP con nonce la
 * pone proxy.ts, porque cambia en cada request.
 */
const SECURITY_HEADERS = [
  // Solo tiene efecto sobre https (en producción); los navegadores lo ignoran en http.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Respaldo de frame-ancestors 'none' para navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
