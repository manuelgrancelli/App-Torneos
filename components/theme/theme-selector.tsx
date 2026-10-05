"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "./theme-provider";
import { cn } from "cn";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Laptop },
  ];

  return (
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Seleccionar tema">
      {options.map(({ value, label, icon: Icon }) => {
        const isSelected = theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-2 font-normal transition-all",
              isSelected && "shadow-xs ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
            role="radio"
            aria-checked={isSelected}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
