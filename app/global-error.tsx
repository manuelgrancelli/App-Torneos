"use client";

import "./globals.css";

/**
 * Último recurso: errores en el layout raíz. Reemplaza todo el documento,
 * por eso define <html> y <body> (y su propio <title>, porque acá no hay
 * metadata) y no depende de otros componentes.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <title>Error · Torneos</title>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">Algo salió mal</h1>
        <p className="max-w-sm text-muted-foreground">
          Ocurrió un error inesperado. Probá recargar la página.
        </p>
        {error.digest ? <p className="text-xs text-muted-foreground">Código de error: {error.digest}</p> : null}
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
