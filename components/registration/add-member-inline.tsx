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
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Ingresá un correo electrónico válido.");
      return;
    }

    startTransition(async () => {
      const result = await addTeamMember({ teamId, email: cleanEmail });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "¡Compañero agregado exitosamente!");
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
    <form onSubmit={handleSubmit} className="space-y-1.5 pt-1">
      <label htmlFor="add-member-email" className="text-xs font-medium text-foreground block">
        Agregar compañero de a uno
      </label>
      <div className="flex gap-2">
        <Input
          id="add-member-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="ejemplo@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          className="h-8 text-xs bg-background"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !email.trim()}
          className="h-8 text-xs shrink-0 gap-1.5"
        >
          {isPending ? <Spinner className="size-3.5" /> : <UserPlus className="size-3.5" />}
          <span>Agregar</span>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ingresá el email de tu compañero para sumarlo a la lista de integrantes.
      </p>
    </form>
  );
}
