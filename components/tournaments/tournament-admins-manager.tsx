"use client";

import {
  Check,
  Copy,
  Crown,
  MessageCircle,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { removeTournamentAdmin, rotateAdminInviteCode } from "@/app/(app)/torneos/[id]/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TournamentAdminMember } from "@/lib/data/tournaments";

export type TournamentAdminsManagerProps = {
  tournamentId: string;
  tournamentName: string;
  isOwner: boolean;
  adminInviteCode?: string | null;
  admins: TournamentAdminMember[];
};

export function TournamentAdminsManager({
  tournamentId,
  tournamentName,
  isOwner,
  adminInviteCode: initialCode,
  admins: initialAdmins,
}: TournamentAdminsManagerProps) {
  const [code, setCode] = useState<string | null>(initialCode ?? null);
  const [admins, setAdmins] = useState<TournamentAdminMember[]>(initialAdmins);
  const [isCopied, setIsCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAdmins(initialAdmins);
  }, [initialAdmins]);

  useEffect(() => {
    setCode(initialCode ?? null);
  }, [initialCode]);

  // URL absoluta de invitación
  const inviteUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/torneos/unirse-admin?code=${code}`
      : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      toast.success("Enlace de invitación copiado.");
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const handleWhatsAppShare = () => {
    if (!inviteUrl) return;
    const text = encodeURIComponent(
      `¡Hola! Te invito a sumarte como administrador del torneo *${tournamentName}* para cargar resultados y gestionar horarios:\n\n${inviteUrl}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const handleRotateCode = () => {
    if (!window.confirm("¿Seguro que querés generar un nuevo enlace? El enlace anterior dejará de funcionar.")) {
      return;
    }

    startTransition(async () => {
      const res = await rotateAdminInviteCode({ tournamentId });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo rotar el enlace.");
        return;
      }

      if (res.data) {
        setCode(res.data.code);
      }
      toast.success(res.message ?? "Nuevo enlace generado.");
    });
  };

  const handleRemoveAdmin = (admin: TournamentAdminMember) => {
    if (!window.confirm(`¿Seguro que querés quitar a ${admin.displayName} como administrador de este torneo?`)) {
      return;
    }

    startTransition(async () => {
      const res = await removeTournamentAdmin({
        tournamentId,
        adminUserId: admin.userId,
      });

      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a.userId !== admin.userId));
        toast.success(res.message ?? "Administrador eliminado.");
      } else {
        toast.error(res.error ?? "No se pudo quitar al administrador.");
      }
    });
  };

  const coAdmins = admins.filter((a) => a.role === "admin");
  const owner = admins.find((a) => a.role === "owner");

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-500" />
            Administradores y colaboradores
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            {admins.length} {admins.length === 1 ? "persona" : "personas"}
          </Badge>
        </div>
        <CardDescription>
          Los administradores pueden cargar y confirmar resultados, cambiar horarios de partidos y armar zonas y playoffs.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Bloque de invitación por enlace (solo visible para el dueño) */}
        {isOwner && code ? (
          <div className="rounded-xl border bg-muted/40 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  <Share2 className="size-4 text-emerald-500" />
                  Enlace de invitación para colaboradores
                </span>
                <p className="text-xs text-muted-foreground">
                  Envíale este enlace a quien quieras sumar como administrador (vía WhatsApp o email).
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRotateCode}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground h-8 self-start sm:self-auto"
                title="Generar un nuevo enlace y anular el anterior"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isPending ? "animate-spin" : ""}`} />
                Rotar enlace
              </Button>
            </div>

            {/* Input con link y botones de acción rápida */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border bg-background text-foreground/90 select-all focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1 sm:flex-none text-xs h-8"
                >
                  {isCopied ? <Check className="size-3.5 mr-1 text-emerald-500" /> : <Copy className="size-3.5 mr-1" />}
                  {isCopied ? "Copiado" : "Copiar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleWhatsAppShare}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                >
                  <MessageCircle className="size-3.5 mr-1" />
                  WhatsApp
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Lista de administradores */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            Equipo de administración
          </span>

          <div className="divide-y rounded-xl border bg-card/60">
            {/* Dueño del torneo */}
            {owner ? (
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 border border-amber-500/30">
                    <AvatarImage src={owner.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-amber-500/10 text-amber-500 text-xs font-bold">
                      {owner.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{owner.displayName}</span>
                      <span title="Organizador principal">
                        <Crown className="size-3.5 text-amber-500" />
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Creador del torneo</span>
                  </div>
                </div>
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[11px]">
                  Organizador
                </Badge>
              </div>
            ) : null}

            {/* Co-administradores */}
            {coAdmins.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Users className="size-4 opacity-50" />
                <span>No hay otros administradores agregados todavía.</span>
              </div>
            ) : (
              coAdmins.map((admin) => (
                <div key={admin.userId} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 border border-emerald-500/30">
                      <AvatarImage src={admin.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                        {admin.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{admin.displayName}</span>
                        <Shield className="size-3.5 text-emerald-500" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {admin.createdAt
                          ? `Sumado el ${new Date(admin.createdAt).toLocaleDateString("es-AR")}`
                          : "Co-administrador"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px]">
                      Administrador
                    </Badge>

                    {isOwner ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveAdmin(admin)}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={`Quitar a ${admin.displayName}`}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Quitar administrador</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
