import { expect, test } from "@playwright/test";
import { expectToast, login, unique } from "./helpers";

const ORGANIZER = "organizador@demo.test";

test.describe("organizador: torneos (F4)", () => {
  test("crear, configurar canchas y franjas, abrir inscripción y regenerar el código", async ({ page }) => {
    const name = unique("Copa E2E");
    await login(page, ORGANIZER);

    // Alta
    await page.getByRole("link", { name: "Crear torneo" }).first().click();
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Deporte").selectOption("padel");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Empieza").fill("2026-11-14");
    await page.getByLabel("Termina").fill("2026-11-15");
    await page.getByLabel(/Cupo de parejas/).fill("8");
    await page.getByLabel("Canchas / sedes").fill("2");
    await page.getByRole("button", { name: "Continuar" }).click();
    // Reglas (D-054): vienen con valores recomendados; la puntuación está plegada.
    await page.locator("summary", { hasText: "Puntuación" }).click();
    await page.getByLabel("Set decisivo").selectOption("full");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Revisá y creá el torneo" })).toBeVisible();
    await page.getByRole("button", { name: "Crear torneo" }).click();
    await expectToast(page, "Torneo creado.");
    await page.waitForURL(/\/torneos\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Borrador").first()).toBeVisible();

    // Abrir la inscripción está bloqueado hasta cargar franjas.
    await expect(page.getByText("Cargá al menos una franja horaria antes de abrir la inscripción.")).toBeVisible();

    // Configuración: cambiar la tabla y guardar.
    await page.getByRole("link", { name: "Configuración" }).click();
    // En edición la tabla de posiciones viene plegada (D-052): se abre antes de editarla.
    await page.locator("summary", { hasText: "Tabla de posiciones" }).click();
    await page.getByLabel("Perdido").fill("1");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expectToast(page, "Guardamos los cambios.");

    // Canchas: renombrar con sede, agregar y borrar.
    await page.getByRole("link", { name: "Canchas y franjas" }).click();
    await page.getByRole("button", { name: "Editar Cancha 1" }).click();
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Guardar" }) }).getByLabel("Nombre").fill("Central");
    await page.locator("form").filter({ has: page.getByRole("button", { name: "Guardar" }) }).getByLabel("Sede (opcional)").fill("Club Norte");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expectToast(page, "Guardamos la cancha.");
    await expect(page.getByText("Club Norte")).toBeVisible();

    const addForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Agregar", exact: true }) });
    await addForm.getByLabel("Nombre").fill("Cancha auxiliar");
    await addForm.getByRole("button", { name: "Agregar", exact: true }).click();
    await expectToast(page, "Agregamos la cancha.");
    await page.getByRole("button", { name: "Borrar Cancha auxiliar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Borrar cancha" }).click();
    await expectToast(page, "Borramos la cancha.");

    // Franjas en lote: 2 días × 09:00–13:00 de 90 min = 4 franjas.
    await page.getByLabel("Desde").fill("09:00");
    await page.getByLabel("Hasta").fill("13:00");
    await page.getByRole("button", { name: "Crear 4 franjas" }).click();
    await expectToast(page, "Creamos 4 franjas.");
    await expect(page.getByText("09:00–10:30").first()).toBeVisible();
    // Repetir no duplica.
    await page.getByRole("button", { name: "Crear 4 franjas" }).click();
    await expectToast(page, /Creamos 0 franjas; 4 ya existían/);

    // Abrir la inscripción.
    await page.getByRole("link", { name: "Resumen" }).click();
    await page.getByRole("button", { name: "Abrir inscripción" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Pasar a/ }).click();
    await expectToast(page, "Actualizamos el estado del torneo.");
    await expect(page.getByText("Inscripción abierta").first()).toBeVisible();

    // La zona horaria queda bloqueada porque ya hay franjas.
    await page.getByRole("link", { name: "Configuración" }).click();
    await expect(page.getByText("La zona horaria no se puede cambiar porque ya hay franjas cargadas.")).toBeVisible();

    // Código: regenerar cambia el link.
    await page.getByRole("link", { name: "Resumen" }).click();
    const before = await page.getByTestId("invite-code").textContent();
    await page.getByRole("button", { name: "Regenerar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Generar código nuevo" }).click();
    await expectToast(page, /Generamos un código nuevo/);
    await expect(page.getByTestId("invite-code")).not.toHaveText(before ?? "");
    await expect(page.getByTestId("invite-url")).toContainText("/unirse/");

    // Aparece en "Mis torneos".
    await page.goto("/torneos");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  });

  test("un borrador se puede eliminar y otro usuario no puede ver su panel", async ({ page, browser }) => {
    const name = unique("Borrador E2E");
    await login(page, ORGANIZER);
    await page.goto("/torneos/nuevo");
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("Deporte").selectOption("futbol-11");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Empieza").fill("2026-12-05");
    await page.getByLabel("Termina").fill("2026-12-05");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Crear torneo" }).click();
    await expectToast(page, "Torneo creado.");
    await page.waitForURL(/\/torneos\/[0-9a-f-]{36}$/);
    const panelUrl = page.url();

    // Otro usuario ve "no encontrado" en el panel ajeno (no se revela que existe).
    const other = await browser.newPage();
    await login(other, "ana@demo.test");
    await other.goto(panelUrl);
    await expect(other.getByText("No encontramos esta página")).toBeVisible();
    await expect(other.getByText(name)).toHaveCount(0);
    await other.close();

    // "Eliminar torneo" está en la sección plegada "Más opciones" (D-052).
    await page.locator("summary", { hasText: "Más opciones" }).click();
    await page.getByRole("button", { name: "Eliminar torneo" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar torneo" }).click();
    await expect(page).toHaveURL("/torneos");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  });
});
