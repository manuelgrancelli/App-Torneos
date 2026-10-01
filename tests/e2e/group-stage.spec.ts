import { expect, test } from "@playwright/test";
import { groupStageScenario } from "./fixtures";
import { expectToast, login, logout } from "./helpers";

test.describe("fase de grupos (F6)", () => {
  test("sortear, programar, cargar resultados (con W.O.), objetar y confirmar", async ({ page }) => {
    const scenario = await groupStageScenario({ requireConfirmation: true });
    const base = `/torneos/${scenario.tournamentId}`;

    await login(page, "organizador@demo.test");

    // Grupos: 1 grupo de 4 → 6 partidos.
    await page.goto(`${base}/grupos`);
    await page.getByLabel("Cantidad de grupos").selectOption("1");
    await page.getByRole("button", { name: "Sortear" }).click();
    await expect(page.getByRole("heading", { name: /Grupo A/ })).toBeVisible();
    // El selector accesible "Mover a…" existe para cada equipo.
    await expect(page.getByRole("combobox", { name: /Mover .* a…/ })).toHaveCount(4);
    await page.getByRole("button", { name: "Confirmar grupos y generar partidos" }).click();
    await expectToast(page, "Guardamos 1 grupo y 6 partidos.");

    // Programación automática: todos entran (6 franjas × 2 canchas).
    await page.goto(`${base}/partidos`);
    await expect(page.getByText("6 partidos sin resultado · 6 sin horario.")).toBeVisible();
    await page.getByRole("button", { name: "Programar automáticamente" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Programar" }).click();
    await expectToast(page, "Programamos 6 partidos.");
    await expect(page.getByText("6 partidos sin resultado · 0 sin horario.")).toBeVisible();

    // Resultados: 5 por marcador y 1 por W.O.
    for (let i = 0; i < 6; i++) {
      await page.getByRole("button", { name: /^Acciones:/ }).nth(i).click();
      await page.getByRole("menuitem", { name: "Cargar resultado" }).click();
      const dialog = page.getByRole("dialog");
      if (i === 5) {
        await dialog.getByText("Ganó por W.O.").click();
        await dialog.getByRole("radio").first().click();
      } else {
        const inputs = dialog.getByRole("spinbutton");
        await inputs.nth(0).fill("6");
        await inputs.nth(1).fill("3");
        await inputs.nth(2).fill("6");
        await inputs.nth(3).fill(String(i % 5));
        await expect(dialog.getByText(/^Gana /)).toBeVisible();
      }
      await dialog.getByRole("button", { name: "Guardar resultado" }).click();
      await expectToast(page, "Guardamos el resultado.");
      await expect(dialog).toBeHidden();
    }
    await expect(page.getByText("Todos los partidos tienen resultado.")).toBeVisible();
    await expect(page.getByText("(W.O.)")).toBeVisible();

    // Validación en vivo: un set imposible no se puede guardar.
    await page.getByRole("button", { name: /^Acciones:/ }).first().click();
    await page.getByRole("menuitem", { name: "Editar resultado" }).click();
    await page.getByRole("dialog").getByRole("spinbutton").nth(1).fill("5");
    await expect(page.getByRole("dialog").getByText("Set 1: 6-5 no es un resultado válido.")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Guardar resultado" })).toBeDisabled();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    // Tabla de posiciones: todos jugaron 3.
    await page.goto(`${base}/grupos`);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Ya hay resultados cargados: los grupos no se pueden rearmar.")).toBeVisible();
    await logout(page);

    // Un participante objeta un resultado de su pareja.
    const ana = scenario.teams.find((t) => t.captain === "ana@demo.test");
    await login(page, "ana@demo.test");
    await page.goto(`/inscripciones/${ana?.id}`);
    await page.getByRole("button", { name: "Objetar" }).first().click();
    await page.getByLabel("¿Qué está mal?").fill("El segundo set fue 6-4.");
    await page.getByRole("button", { name: "Enviar objeción" }).click();
    await expectToast(page, /objetado/);
    await logout(page);

    // El organizador lo ve objetado y lo confirma igual.
    await login(page, "organizador@demo.test");
    await page.goto(`${base}/partidos`);
    await page.getByRole("tab", { name: /Objetados/ }).click();
    await expect(page.getByText('"El segundo set fue 6-4."')).toBeVisible();
    await page.getByRole("button", { name: /^Acciones:/ }).first().click();
    await page.getByRole("menuitem", { name: "Confirmar resultado" }).click();
    await expectToast(page, "Resultado confirmado.");
    await expect(page.getByRole("tab", { name: /Objetados/ })).toContainText("0");
  });
});
