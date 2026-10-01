import type { MetadataRoute } from "next";

/**
 * Solo se indexan la portada y las páginas públicas de torneos. El área
 * privada, la inscripción y los flujos de auth no tienen nada que indexar
 * (además, llevan `noindex`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/t/"],
      disallow: [
        "/torneos",
        "/unirse",
        "/inscripciones",
        "/historial",
        "/proximos",
        "/perfil",
        "/actualizar-clave",
        "/auth/",
      ],
    },
  };
}
