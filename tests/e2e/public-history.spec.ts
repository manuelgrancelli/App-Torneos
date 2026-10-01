import { type Page, expect, test } from "@playwright/test";
import { draftTournament, organizerClient, scheduledGroupScenario } from "./fixtures";
import { expectToast, login } from "./helpers";

/** Valor de una estadística del historial ("Partidos", "Ganados"…). */
function stat(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd").first();
}

test.describe("página pública, historial y próximos (F8)", () => {
  test("página pública sin sesión: grupos, fixture y datos frescos al cargar un resultado", async ({ page, browser }) => {
    const scenario = await scheduledGroupScenario();
    const publicUrl = `/t/${scenario.slug}`;

    // `page` no tiene sesión: es lo que ve cualquier visitante.
    await page.goto(publicUrl);
    await expect(page.getByRole("heading", { level: 1, name: scenario.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();

    // Vista por defecto en fase de grupos: tabla de posiciones.
    await expect(page.getByRole("link", { name: "Grupos" })).toHaveAttribute("aria-current", "page");
    const table = page.getByRole("table", { name: "Grupo A" });
    for (const team of scenario.teams) await expect(table.getByText(team.name)).toBeVisible();
    // Sin cuadro todavía, no hay pestaña de cuadro.
    await expect(page.getByRole("link", { name: "Cuadro" })).toHaveCount(0);

    // Fixture por día, en la zona del torneo.
    await page.getByRole("link", { name: "Fixture" }).click();
    await expect(page).toHaveURL(/vista=fixture/);
    await expect(page.getByRole("heading", { name: /sábado 21 de noviembre/i })).toBeVisible();
    await expect(page.getByText("09:00–10:30").first()).toBeVisible();
    await expect(page.getByText("Por jugar")).toHaveCount(6);

    // El organizador carga un resultado (otra sesión): la página pública se invalida por tag.
    const context = await browser.newContext();
    const organizer = await context.newPage();
    await login(organizer, "organizador@demo.test");
    await organizer.goto(`/torneos/${scenario.tournamentId}/partidos`);
    await organizer.getByRole("button", { name: /^Acciones:/ }).first().click();
    await organizer.getByRole("menuitem", { name: "Cargar resultado" }).click();
    const inputs = organizer.getByRole("dialog").getByRole("spinbutton");
    for (const [index, value] of ["6", "4", "6", "4"].entries()) await inputs.nth(index).fill(value);
    await organizer.getByRole("dialog").getByRole("button", { name: "Guardar resultado" }).click();
    await expectToast(organizer, "Guardamos el resultado.");
    await context.close();

    await page.reload();
    await expect(page.getByText("6-4 6-4")).toBeVisible();
    await expect(page.getByText("Por jugar")).toHaveCount(5);
  });

  test("un torneo en borrador no tiene página pública", async ({ page }) => {
    const { slug } = await draftTournament();
    const response = await page.goto(`/t/${slug}`);
    expect(response?.status()).toBe(404);
  });

  test("historial con filtros y próximos partidos", async ({ page }) => {
    const scenario = await scheduledGroupScenario();
    const ana = scenario.teams.find((t) => t.captain === "ana@demo.test");
    if (!ana) throw new Error("Falta la pareja de Ana en el escenario");

    // Un partido de Ana jugado (y ganado); quedan 2 por jugar.
    const organizer = await organizerClient();
    const { data: match } = await organizer
      .from("matches")
      .select("id")
      .eq("tournament_id", scenario.tournamentId)
      .or(`home_team_id.eq.${ana.id},away_team_id.eq.${ana.id}`)
      .order("round")
      .limit(1)
      .single();
    const { error } = await organizer.rpc("record_match_result", {
      p_match_id: match?.id as string,
      p_result: { type: "sets", sets: [{ home: 6, away: 3 }, { home: 6, away: 3 }] },
      p_winner_team_id: ana.id,
    });
    expect(error).toBeNull();
    await organizer.auth.signOut();

    await login(page, "ana@demo.test");

    // Próximos: los 2 partidos sin resultado, con día, cancha y torneo.
    await page.goto("/proximos");
    const upcoming = page.getByRole("listitem").filter({ hasText: scenario.name });
    await expect(upcoming).toHaveCount(2);
    await expect(page.getByRole("heading", { name: /sábado 21 de noviembre/i })).toBeVisible();
    await expect(upcoming.first()).toContainText("Cancha");
    await expect(upcoming.first().getByRole("link", { name: scenario.name })).toHaveAttribute(
      "href",
      `/inscripciones/${ana.id}`,
    );

    // Historial filtrado por el torneo: 1 partido, ganado.
    await page.goto("/historial");
    await page.getByLabel("Torneo", { exact: true }).selectOption({ label: scenario.name });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(new RegExp(`torneo=${scenario.tournamentId}`));
    await expect(stat(page, "Partidos")).toHaveText("1");
    await expect(stat(page, "Ganados")).toHaveText("1");
    await expect(stat(page, "Efectividad")).toHaveText("100 %");
    const section = page.getByRole("region", { name: scenario.name });
    await expect(section.getByText("6-3 6-3")).toBeVisible();
    await expect(section.getByText("Ganado")).toBeVisible();
    await expect(section.getByText(/con Bruno/)).toBeVisible();

    // Filtro de resultado sin coincidencias (la URL se puede compartir).
    await page.getByLabel("Resultado", { exact: true }).selectOption({ label: "Perdidos" });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/resultado=perdidos/);
    await expect(page.getByText("No hay partidos con esos filtros.")).toBeVisible();
    // Las estadísticas no cambian con el filtro de resultado.
    await expect(stat(page, "Partidos")).toHaveText("1");

    await page.getByRole("link", { name: "Limpiar" }).click();
    await expect(page).toHaveURL(/\/historial$/);
  });
});
