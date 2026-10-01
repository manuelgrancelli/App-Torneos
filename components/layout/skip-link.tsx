/** Link "Saltar al contenido" para teclado y lectores de pantalla: solo se ve con foco. */
export function SkipLink({ targetId = "contenido" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow focus:ring-2 focus:ring-ring"
    >
      Saltar al contenido
    </a>
  );
}
