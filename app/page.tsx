import { CalendarCheck, Network, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrophyLogo } from "@/components/brand/trophy-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { DEFAULT_REDIRECT } from "@/lib/utils/redirect";

const FEATURES = [
  { icon: Users, title: "Inscripciones", text: "Parejas y equipos se anotan con un link o un código." },
  { icon: CalendarCheck, title: "Horarios", text: "Cada uno marca cuándo puede jugar y el fixture se arma solo." },
  { icon: Network, title: "Grupos y cuadros", text: "Tablas de posiciones y playoffs que avanzan con cada resultado." },
];

/** Portada pública. Con sesión iniciada lleva directo a "Mis torneos". */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(DEFAULT_REDIRECT);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-4 py-12">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-2.5 font-semibold text-lg">
            <TrophyLogo size="md" />
            <span>{APP_NAME}</span>
          </p>
          <ThemeToggle />
        </div>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
          Tus torneos, de la inscripción a la final.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">{APP_DESCRIPTION}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/registro">Crear cuenta</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Ingresar</Link>
          </Button>
        </div>
      </section>
      <section aria-label="Funcionalidades" className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-lg border p-5">
            <Icon className="mb-3 size-5" aria-hidden="true" />
            <h2 className="font-medium">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
