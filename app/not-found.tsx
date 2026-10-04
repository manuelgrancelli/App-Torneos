import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <p className="max-w-sm text-muted-foreground">
        Puede que el link esté mal escrito o que el contenido ya no exista.
      </p>
      <Button asChild>
        <Link href="/">Ir al inicio</Link>
      </Button>
    </main>
  );
}
