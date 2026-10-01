import { z } from "zod";

/**
 * Mensajes de Zod en español como respaldo global. Los campos de los
 * formularios definen sus propios mensajes; esto cubre validaciones de los
 * esquemas de dominio que no los tienen. Se importa desde lib/validation/*.
 */
z.config(z.locales.es());
