import { Skeleton } from "@/components/ui/skeleton";

export default function BracketLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Cargando cuadro eliminatorio…</span>
      
      {/* Barra superior de acciones y selector de categoría */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
      </div>

      {/* Columnas del Bracket (Octavos / Cuartos / Semis / Final) */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-8 min-w-[700px]">
          {/* Columna 1 (Ronda inicial) */}
          <div className="flex-1 space-y-4">
            <Skeleton className="h-6 w-24 mx-auto rounded-md" />
            <div className="space-y-6">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>

          {/* Columna 2 (Semifinales) */}
          <div className="flex-1 space-y-4 pt-8">
            <Skeleton className="h-6 w-24 mx-auto rounded-md" />
            <div className="space-y-16">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>

          {/* Columna 3 (Final) */}
          <div className="flex-1 space-y-4 pt-16">
            <Skeleton className="h-6 w-24 mx-auto rounded-md" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

