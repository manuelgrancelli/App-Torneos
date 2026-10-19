"use client";

import { Check, ShieldCheck, Trophy, UserCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { joinTournamentAsAdmin } from "@/app/(app)/torneos/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export type AdminInviteInfo = {
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  sportName: string;
  organizerName: string;
  status: string;
  startsOn: string;
  endsOn: string;
  isAlreadyAdmin: boolean;
};

export function JoinAdminCard({
  invite,
  code,
}: {
  invite: AdminInviteInfo;
  code: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [hasJoined, setHasJoined] = useState(invite.isAlreadyAdmin);
  const router = useRouter();

  const handleJoin = () => {
    startTransition(async () => {
      const res = await joinTournamentAsAdmin({ code });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo procesar la invitación.");
        return;
      }

      setHasJoined(true);
      toast.success(res.message ?? "¡Te uniste como administrador!");
      if (res.data) {
        router.push(`/torneos/${res.data.tournamentId}`);
        router.refresh();
      }
    });
  };

  return (
    <Card className="max-w-md w-full mx-auto border-border/80 shadow-xl">
      <CardHeader className="text-center space-y-2 pb-4">
        <div className="mx-auto size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-xs">
          <ShieldCheck className="size-8" />
        </div>
        <CardTitle className="text-xl font-bold">
          Invitación de Administrador
        </CardTitle>
        <CardDescription>
          Fuiste invitado a ser co-administrador del torneo:
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ficha del torneo */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-lg text-foreground leading-tight">
                {invite.tournamentName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Organizado por <span className="font-semibold text-foreground/90">{invite.organizerName}</span>
              </p>
            </div>
            <Badge variant="outline" className="text-xs uppercase shrink-0 font-medium">
              {invite.sportName}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground pt-1 border-t flex items-center gap-1.5">
            <Trophy className="size-3.5 text-amber-500" />
            <span>
              Fechas: {new Date(invite.startsOn).toLocaleDateString("es-AR")} al {new Date(invite.endsOn).toLocaleDateString("es-AR")}
            </span>
          </div>
        </div>

        {/* Explicación de permisos */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-foreground/80 space-y-2">
          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-500" /> ¿Qué vas a poder hacer?
          </span>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
            <li>Cargar y actualizar resultados de los partidos.</li>
            <li>Asignar y modificar horarios y canchas.</li>
            <li>Gestionar zonas, armar cruces y playoffs.</li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-2">
        {hasJoined ? (
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-500 py-1">
              <UserCheck className="size-4" /> Ya sos administrador de este torneo
            </div>
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              <Link href={`/torneos/${invite.tournamentId}`}>
                Ir al panel del torneo
              </Link>
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleJoin}
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10"
          >
            {isPending ? <Spinner className="size-4 mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
            {isPending ? "Uniéndote…" : "Aceptar y unirme como administrador"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
