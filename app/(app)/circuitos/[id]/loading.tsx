import { Skeleton } from "@/components/ui/skeleton";

export default function CircuitDetailLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Cargando circuito…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-72 rounded-lg" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
