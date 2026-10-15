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

import { Crown } from "lucide-react";

export type TeamCategoryOption = {
  id: string;
  name: string;
  status: string;
  maxTeams: number | null;
  approvedTeamsCount: number;
};

type TeamFormProps = {
  /** Integrantes que necesita el deporte (incluido quien inscribe). */
  teamSize: number;
  defaultName: string;
  defaultEmails?: string[];
  categories?: TeamCategoryOption[];
  captainName?: string;
  captainEmail?: string;
  onSaved?: () => void;
} & ({ mode: "register"; code: string } | { mode: "edit"; teamId: string });

/** Alta de inscripción o edición del plantel (capitán). */
export function TeamForm(props: TeamFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const companions = Math.max(props.teamSize - 1, 0);
  const noun = teamNoun(props.teamSize);

  const defaultCategory =
    props.mode === "register" && props.categories && props.categories.length > 0
      ? (props.categories.find(
          (c) =>
            c.status === "registration_open" &&
            (c.maxTeams === null || c.approvedTeamsCount < c.maxTeams)
        )?.id ?? props.categories[0]?.id)
      : undefined;

  const form = useForm({
    resolver: zodResolver(registerTeamSchema),
    defaultValues: {
      code: props.mode === "register" ? props.code : "edit",
      categoryId: defaultCategory,
      teamName: props.defaultName,
      memberEmails: props.defaultEmails && props.defaultEmails.length > 0 ? props.defaultEmails : Array.from({ length: companions }, () => ""),
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    // Validar en el cliente que no ingrese su propio email como compañero
    const captainEmailNormalized = props.captainEmail?.toLowerCase().trim();
    if (captainEmailNormalized) {
      const hasSelf = values.memberEmails.some((e) => e.toLowerCase().trim() === captainEmailNormalized);
      if (hasSelf) {
        form.setError("memberEmails", {
          message: props.teamSize === 2
            ? "No podés ingresar tu propio email: vos ya sos el capitán de la pareja."
            : "No podés incluir tu propio email: vos ya sos el capitán del equipo.",
        });
        toast.error("No podés incluir tu propio email como compañero.");
        return;
      }
    }

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
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-sm">
          <Crown className="size-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 min-w-0">
            <p className="font-semibold text-foreground">
              {props.mode === "register" ? "Vos sos el Capitán" : "Capitán de la pareja"}
              {props.captainName || props.captainEmail ? (
                <span className="font-normal text-muted-foreground ml-1">
                  ({props.captainName ?? props.captainEmail})
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {props.teamSize === 2
                ? "El pádel se juega en parejas (2 personas). Vos ya quedás registrado como capitán; abajo tenés que ingresar el email de tu pareja para invitarla."
                : `Vos ya quedás registrado como capitán del equipo; abajo tenés que ingresar los emails de tus ${companions} compañeros.`}
            </p>
          </div>
        </div>

        {props.mode === "register" && props.categories && props.categories.length > 0 ? (
          <Controller
            name="categoryId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="category-select">Categoría en la que te inscribís</FieldLabel>
                <select
                  id="category-select"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                >
                  <option value="" disabled>
                    Elegí una categoría...
                  </option>
                  {props.categories?.map((cat) => {
                    const isFull = cat.maxTeams !== null && cat.approvedTeamsCount >= cat.maxTeams;
                    const isClosed = cat.status !== "registration_open";
                    const cupoText =
                      cat.maxTeams !== null
                        ? `(${cat.approvedTeamsCount}/${cat.maxTeams})`
                        : `(${cat.approvedTeamsCount} inscriptas · sin límite)`;
                    return (
                      <option key={cat.id} value={cat.id} disabled={isClosed || isFull}>
                        {cat.name} {isClosed ? "(Inscripción cerrada)" : isFull ? "(Cupo lleno)" : cupoText}
                      </option>
                    );
                  })}
                </select>
                <FieldDescription>
                  Este torneo integra múltiples categorías. Seleccioná en cuál va a jugar tu {noun}.
                </FieldDescription>
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        ) : null}

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
