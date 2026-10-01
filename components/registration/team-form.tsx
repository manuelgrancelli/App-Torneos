"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateRoster } from "@/app/(app)/inscripciones/[teamId]/actions";
import { registerTeam } from "@/app/(app)/unirse/[code]/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { teamNoun } from "@/lib/domain/tournament-status";
import { applyServerErrors, firstErrorMessage } from "@/lib/forms";
import { registerTeamSchema } from "@/lib/validation/registration";
import { MemberEmailsField } from "./member-emails-field";

type TeamFormProps = {
  /** Integrantes que necesita el deporte (incluido quien inscribe). */
  teamSize: number;
  defaultName: string;
  defaultEmails?: string[];
  onSaved?: () => void;
} & ({ mode: "register"; code: string } | { mode: "edit"; teamId: string });

/** Alta de inscripción o edición del plantel (capitán). */
export function TeamForm(props: TeamFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const companions = Math.max(props.teamSize - 1, 0);
  const noun = teamNoun(props.teamSize);

  const form = useForm({
    resolver: zodResolver(registerTeamSchema),
    defaultValues: {
      code: props.mode === "register" ? props.code : "edit",
      teamName: props.defaultName,
      memberEmails: props.defaultEmails ?? Array.from({ length: companions }, () => ""),
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      if (props.mode === "register") {
        const result = await registerTeam(values);
        if (!result.ok) {
          applyServerErrors(form.setError, result.fieldErrors);
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "¡Listo!");
        router.push(`/inscripciones/${result.data.teamId}`);
        return;
      }

      const result = await updateRoster({
        teamId: props.teamId,
        teamName: values.teamName,
        memberEmails: values.memberEmails,
      });
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Guardamos el equipo.");
      props.onSaved?.();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          name="teamName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${props.mode}-team-name`}>Nombre de la {noun === "pareja" ? "pareja" : "inscripción"}</FieldLabel>
              <Input {...field} id={`${props.mode}-team-name`} aria-invalid={fieldState.invalid} />
              <FieldDescription>
                {props.teamSize === 2 ? 'Por ejemplo "Pérez / Gómez". Es lo que se ve en el fixture.' : "Es lo que se ve en el fixture."}
              </FieldDescription>
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="memberEmails"
          control={form.control}
          render={({ field, fieldState }) => {
            const perIndex = Array.isArray(fieldState.error)
              ? (fieldState.error as ({ message?: string } | undefined)[]).map((e) => e?.message)
              : [];
            return (
              <MemberEmailsField
                idPrefix={`${props.mode}-email`}
                count={companions}
                value={field.value}
                onChange={field.onChange}
                errors={perIndex}
                generalError={Array.isArray(fieldState.error) ? undefined : firstErrorMessage(fieldState.error)}
              />
            );
          }}
        />
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <Spinner /> : null}
          {props.mode === "register" ? "Inscribirme" : "Guardar equipo"}
        </Button>
      </FieldGroup>
    </form>
  );
}
