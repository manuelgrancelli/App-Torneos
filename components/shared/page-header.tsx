type PageHeaderProps = {
  title: string;
  description?: string;
  /** Acciones a la derecha (en mobile pasan abajo del título). */
  actions?: React.ReactNode;
};

/** Encabezado estándar de página: un único h1 por pantalla. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
