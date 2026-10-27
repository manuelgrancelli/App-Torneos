"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addTeamMember } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type AddMemberInlineProps = {
  teamId: string;
  isFull: boolean;
};

export function AddMemberInline({ teamId, isFull }: AddMemberInlineProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName && !cleanEmail) {
      toast.error("Ingresá el nombre o el correo del jugador.");
      return;
    }

    startTransition(async () => {
      const result = await addTeamMember({ teamId, name: cleanName, email: cleanEmail });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "¡Compañero agregado exitosamente!");
      setName("");
      setEmail("");
      router.refresh();
    });
  }

  if (isFull) {
    return (
      <p className="text-xs text-muted-foreground italic pt-1">
        El equipo ya alcanzó el límite máximo de integrantes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-border/60">
      <label className="text-xs font-semibold text-foreground block">
        Agregar jugador al plantel
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          type="text"
          placeholder="Nombre y apellido"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="h-8 text-xs bg-background"
        />
        <div className="flex gap-1.5">
          <Input
            type="email"
            inputMode="email"
            placeholder="Email (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="h-8 text-xs bg-background flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPending || (!name.trim() && !email.trim())}
            className="h-8 text-xs shrink-0 gap-1.5"
          >
            {isPending ? <Spinner className="size-3.5" /> : <UserPlus className="size-3.5" />}
            <span>Agregar</span>
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Podés cargarlo con su nombre, o sumar su email para que vincule su cuenta.
      </p>
    </form>
  );
}
