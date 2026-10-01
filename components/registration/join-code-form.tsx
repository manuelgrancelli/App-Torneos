"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { normalizeInviteCode } from "@/lib/validation/registration";

/** "¿Tenés un código?": lleva a la pantalla de inscripción del torneo. */
export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (normalized.length !== 10) {
      setError("El código tiene 10 letras y números (por ejemplo DEMQ2-PADEL).");
      return;
    }
    router.push(`/unirse/${normalized}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field data-invalid={Boolean(error)} className="flex-1">
        <FieldLabel htmlFor="join-code">¿Tenés un código de inscripción?</FieldLabel>
        <Input
          id="join-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="XXXXX-XXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={Boolean(error)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <Button type="submit" variant="outline">
        Inscribirme
        <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
