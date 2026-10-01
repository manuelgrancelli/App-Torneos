"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { updatePassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { applyServerErrors } from "@/lib/forms";
import { DEFAULT_REDIRECT } from "@/lib/utils/redirect";
import { updatePasswordSchema } from "@/lib/validation/auth";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updatePassword(values);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Actualizamos tu contraseña.");
      router.replace(DEFAULT_REDIRECT);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
              <Input
                {...field}
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                aria-describedby="new-password-help"
              />
              <FieldDescription id="new-password-help">Mínimo 8 caracteres.</FieldDescription>
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="new-password-confirm">Repetí la contraseña</FieldLabel>
              <Input
                {...field}
                id="new-password-confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Guardar contraseña
        </Button>
      </FieldGroup>
    </form>
  );
}
