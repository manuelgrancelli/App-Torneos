import { redirect } from "next/navigation";

/** El apartado independiente de categorías quedó obsoleto; se gestiona directamente en Inscripciones. */
export default async function CategoriesPage({
  params,
}: PageProps<"/torneos/[id]/categorias">) {
  const { id } = await params;
  redirect(`/torneos/${id}/inscripciones`);
}

