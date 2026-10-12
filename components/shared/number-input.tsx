"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
};

/**
 * Input numérico con teclado numérico en mobile y botones de incremento/decremento (stepper).
 * Usa `inputMode="numeric"` con `type="text"` para evitar que los teclados virtuales de mobile
 * bloqueen la tecla borrar (backspace) cuando el campo tiene `min` o queda temporalmente vacío.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  disabled,
  onFocus,
  ...props
}: NumberInputProps) {
  const numValue = typeof value === "number" && !Number.isNaN(value) ? value : undefined;
  const numMin = typeof min === "number" ? min : typeof min === "string" ? Number(min) : undefined;
  const numMax = typeof max === "number" ? max : typeof max === "string" ? Number(max) : undefined;
  const numStep = typeof step === "number" ? step : typeof step === "string" ? Number(step) : 1;

  const handleDecrement = () => {
    if (disabled) return;
    const current = numValue ?? numMin ?? 0;
    const next = current - numStep;
    if (numMin !== undefined && next < numMin) {
      onChange(numMin);
      return;
    }
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const current = numValue ?? (numMin !== undefined ? numMin - numStep : 0);
    const next = current + numStep;
    if (numMax !== undefined && next > numMax) {
      onChange(numMax);
      return;
    }
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0 touch-manipulation md:size-8"
        onClick={handleDecrement}
        disabled={disabled || (numValue !== undefined && numMin !== undefined && numValue <= numMin)}
        aria-label="Disminuir"
        tabIndex={-1}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>

      <Input
        {...props}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        className={cn("text-center font-medium", className)}
        value={value ?? ""}
        onFocus={(e) => {
          e.currentTarget.select();
          onFocus?.(e);
        }}
        onChange={(event) => {
          const raw = event.target.value.replace(/\D/g, "");
          onChange(raw === "" ? undefined : Number(raw));
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0 touch-manipulation md:size-8"
        onClick={handleIncrement}
        disabled={disabled || (numValue !== undefined && numMax !== undefined && numValue >= numMax)}
        aria-label="Aumentar"
        tabIndex={-1}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
