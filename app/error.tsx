"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Error inesperado en cualquier ruta. Nunca se muestra `error.message` al
 * usuario (puede traer detalles internos); solo el `digest`, que sirve para
 * buscar el error en los logs del servidor.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <TriangleAlert className="size-10 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">Algo salió mal</h1>
      <p className="max-w-sm text-muted-foreground">
        Ocurrió un error inesperado. Probá de nuevo en unos segundos.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Código de error: {error.digest}</p>
      ) : null}
      <Button onClick={() => retry()}>Reintentar</Button>
    </div>
  );
}
