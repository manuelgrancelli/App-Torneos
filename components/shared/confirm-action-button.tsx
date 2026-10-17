"use client";

import { useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ConfirmActionButtonProps = {
  /** Contenido del botón que abre la confirmación. */
  children: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  /** La acción a confirmar. Si devuelve false, el diálogo queda abierto. */
  onConfirm: () => Promise<boolean | void>;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  confirmClassName?: string;
  "aria-label"?: string;
};

/** Botón con diálogo de confirmación para acciones destructivas o irreversibles. */
export function ConfirmActionButton({
  children,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  variant = "outline",
  size,
  destructive = false,
  disabled,
  className,
  confirmClassName,
  ...rest
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(event: React.MouseEvent) {
    // Se maneja el cierre a mano para poder esperar la acción.
    event.preventDefault();
    startTransition(async () => {
      const keepOpen = (await onConfirm()) === false;
      if (!keepOpen) setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled} className={className} aria-label={rest["aria-label"]}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">{title}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              destructive && "!bg-destructive !text-white hover:!bg-destructive/90 shadow-xs",
              confirmClassName,
            )}
          >
            {isPending ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
