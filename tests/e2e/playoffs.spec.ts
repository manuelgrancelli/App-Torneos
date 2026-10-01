import { expect, test } from "@playwright/test";
import { playoffsScenario } from "./fixtures";
import { expectToast, login } from "./helpers";

test.describe("playoffs (F7)", () => {
  test("generar cuadro de 4 con 3er puesto, avance automático y campeón", async ({ page }) => {
    const scenario = await playoffsScenario();
    const base = `/torneos/${scenario.tournamentId}`;
    await login(page, "organizador@demo.test");

    await page.goto(`${base}/cuadro`);
    await page.getByLabel("Clasifican por grupo").selectOption("4");
    await expect(page.getByLabel("Partido por el 3er puesto")).toBeVisible();
    await page.getByLabel("Partido por el 3er puesto").check();
    // Vista previa: semifinales + final + 3er puesto.
    await expect(page.getByRole("heading", { name: "Semifinal" })).toBeVisible();
    await page.getByRole("button", { name: "Generar cuadro" }).click();
    await expectToast(page, /Generamos el cuadro de 4\. La primera ronda quedó programada\./);

    const region = page.getByRole("region", { name: "Cuadro de playoffs" });
    await expect(region.getByText("A definir").first()).toBeVisible();

    // Semifinales (las dos primeras filas del tablero de partidos).
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: /^Acciones:/ }).nth(i).click();
      await page.getByRole("menuitem", { name: "Cargar resultado" }).click();
      const dialog = page.getByRole("dialog");
      const inputs = dialog.getByRole("spinbutton");
      await inputs.nth(0).fill("6");
      await inputs.nth(1).fill("4");
      await inputs.nth(2).fill("6");
      await inputs.nth(3).fill("4");
      await dialog.getByRole("button", { name: "Guardar resultado" }).click();
      await expect(dialog).toBeHidden();
    }
    // Al completar la segunda semi, la final y el 3er puesto se programan solos.
    await expectToast(page, "Guardamos el resultado y programamos 2 partidos siguientes.");
    await expect(region.getByText("A definir")).toHaveCount(0);

    // Final y 3er puesto.
    for (const index of [2, 3]) {
      await page.getByRole("button", { name: /^Acciones:/ }).nth(index).click();
      await page.getByRole("menuitem", { name: "Cargar resultado" }).click();
      const dialog = page.getByRole("dialog");
      const inputs = dialog.getByRole("spinbutton");
      await inputs.nth(0).fill("7");
      await inputs.nth(1).fill("6");
      await inputs.nth(2).fill("6");
      await inputs.nth(3).fill("1");
      await dialog.getByRole("button", { name: "Guardar resultado" }).click();
      await expect(dialog).toBeHidden();
    }

    // Finalizar el torneo: aparece el campeón.
    await page.goto(base);
    await page.getByRole("button", { name: "Finalizar torneo" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Pasar a/ }).click();
    await expectToast(page, "Actualizamos el estado del torneo.");
    await expect(page.getByText(/Campeón: /)).toBeVisible();
    await expect(page.getByText("Finalizado").first()).toBeVisible();
  });
});
