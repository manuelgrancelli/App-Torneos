"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldAlert, UserPlus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import type { SuperAdminUser } from "@/lib/data/admin";
import { manageSuperAdminAction } from "@/app/(app)/admin/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function SuperAdminsDialog({
  superAdmins,
  currentUserEmail,
}: {
  superAdmins: SuperAdminUser[];
  currentUserEmail?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adminList, setAdminList] = useState<SuperAdminUser[]>(superAdmins);
  const [emailInput, setEmailInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAdminList(superAdmins);
  }, [superAdmins]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await manageSuperAdminAction({
        email: cleanEmail,
        action: "add",
      });

      if (!result.ok) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg(result.data.message);
        setEmailInput("");

        // Agregar optimísticamente a la lista local para respuesta inmediata
        setAdminList((prev) => {
          if (prev.some((a) => a.email.toLowerCase() === cleanEmail.toLowerCase())) {
            return prev;
          }
          return [
            ...prev,
            {
              id: result.data.user?.id || cleanEmail,
              fullName: result.data.user?.fullName || cleanEmail,
              email: cleanEmail,
              createdAt: new Date().toISOString(),
            },
          ];
        });

        router.refresh();
      }
    });
  };

  const handleRemove = (targetEmail: string) => {
    if (!confirm(`¿Estás seguro de quitar los permisos de Superadministrador a ${targetEmail}?`)) {
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await manageSuperAdminAction({
        email: targetEmail,
        action: "remove",
      });

      if (!result.ok) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg(result.data.message);

        // Remover optimísticamente de la lista local
        setAdminList((prev) =>
          prev.filter((a) => a.email.toLowerCase() !== targetEmail.toLowerCase())
        );

        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
        >
          <Shield className="size-4 text-amber-500" />
          <span>Superadministradores ({adminList.length})</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Superadministradores de la Plataforma
              </DialogTitle>
              <DialogDescription className="text-xs">
                Gestioná qué cuentas tienen acceso total al panel y auditoría global.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario para agregar */}
        <form onSubmit={handleAdd} className="space-y-2 pt-1">
          <label className="text-xs font-medium text-foreground">
            Nombrar nuevo Superadministrador:
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="ejemplo@correo.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={isPending}
              className="text-xs"
              required
            />
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !emailInput.trim()}
              className="shrink-0 gap-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <UserPlus className="size-3.5" />
              <span>{isPending ? "Agregando..." : "Agregar"}</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            El usuario debe estar previamente registrado con este correo en la página.
          </p>
        </form>

        <div className="my-2 border-t" />

        {/* Lista de superadmins */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cuentas con acceso activo ({adminList.length})
          </span>
          <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {adminList.map((admin) => {
              const isSelf =
                currentUserEmail && admin.email.toLowerCase() === currentUserEmail.toLowerCase();

              return (
                <div
                  key={admin.id || admin.email}
                  className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5 text-xs transition-colors hover:bg-muted/70"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {admin.fullName}
                      </span>
                      {isSelf && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                          Vos
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground truncate block">{admin.email}</span>
                  </div>

                  {!isSelf && adminList.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(admin.email)}
                      disabled={isPending}
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Quitar permisos de superadmin"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
