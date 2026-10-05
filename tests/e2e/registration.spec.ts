import { expect, test } from "@playwright/test";
import { prepareTeamInvitation } from "./fixtures";
import { expectToast, extractConfirmLink, login, logout, signUpAndConfirm, unique, uniqueEmail, waitForMail } from "./helpers";

/** Código fijo del torneo demo del seed (supabase/seed.sql). */
const DEMO_CODE = "DEMQ2PADEL";
const ORGANIZER = "organizador@demo.test";

test.describe("inscripción y disponibilidad (F5)", () => {
  test("pareja con compañero sin cuenta: inscribir, marcar disponibilidad, vincular, aprobar y salir", async ({ page }) => {
    const captainEmail = uniqueEmail("capitan");
    const partnerEmail = uniqueEmail("pareja");
    const teamName = unique("Pareja E2E");

    // 1. El capitán se registra y entra con el código (con guion y minúsculas).
    await signUpAndConfirm(page, { name: "Carlos Capitán", email: captainEmail });
    await page.getByLabel("¿Tenés un código de inscripción?").fill("demq2-padel");
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expect(page).toHaveURL(`/unirse/${DEMO_CODE}`);
    await expect(page.getByLabel("Nombre de la pareja")).toHaveValue("Capitán / ");

    await page.getByLabel("Nombre de la pareja").fill(teamName);
    await page.getByLabel("Email de tu pareja").fill(partnerEmail);
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expectToast(page, /La inscripción quedó pendiente|Tu inscripción quedó pendiente/);
    await page.waitForURL(/\/inscripciones\/[0-9a-f-]{36}$/);
    const teamUrl = page.url();
    const teamId = teamUrl.split("/").pop();
    expect(teamId).toBeTruthy();
    await expect(page.getByText("Pendiente de aceptar la invitación")).toBeVisible();
    await expect(page.getByText("Tu inscripción está pendiente")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar / reenviar invitación" })).toBeVisible();

    // 2. Marca disponibilidad: dos franjas y "todo el día".
    const firstDay = page.getByRole("checkbox").first();
    await firstDay.click();
    await expect(page.getByText("1 franja elegida")).toBeVisible();
    await page.getByRole("button", { name: "Todo el día" }).first().click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expectToast(page, /Guardamos \d+ franjas/);

    // 3. Ya inscripto: volver a entrar con el código lleva a la inscripción.
    await page.goto(`/unirse/${DEMO_CODE}`);
    await expect(page.getByText("Ya estás inscripto en este torneo")).toBeVisible();
    await logout(page);

    // 4. El compañero acepta una invitación usando la cuenta del email destinatario.
    const invitationToken = await prepareTeamInvitation({
      captainEmail,
      teamId: teamId!,
      memberEmail: partnerEmail,
    });
    const invitationUrl = `/invitacion/aceptar?token=${encodeURIComponent(invitationToken)}`;
    await page.goto(invitationUrl);
    await page.getByRole("link", { name: "Crear cuenta con este email" }).click();
    await page.getByLabel("Nombre y apellido").fill("Paula Pareja");
    await page.getByLabel("Email").fill(partnerEmail);
    await page.getByLabel("Contraseña", { exact: true }).fill("demo1234");
    await page.getByLabel("Repetí la contraseña").fill("demo1234");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Revisá tu email")).toBeVisible();
    await page.goto(extractConfirmLink(await waitForMail(partnerEmail, "Confirmá tu cuenta")));
    await expect(page).toHaveURL(invitationUrl);
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page).toHaveURL(teamUrl);
    await expect(page.getByText("Paula Pareja")).toBeVisible();
    await logout(page);

    // 5. El organizador ve la inscripción y la aprueba.
    await login(page, ORGANIZER);
    await page.getByRole("link", { name: /Torneo Demo de Pádel/ }).click();
    await page.getByRole("link", { name: "Inscripciones" }).click();
    const card = page.locator("li").filter({ hasText: teamName });
    await expect(card.getByText(partnerEmail)).toBeVisible();
    await card.getByRole("button", { name: `Aprobar ${teamName}` }).click();
    await expectToast(page, "Inscripción aprobada.");

    // Resumen de disponibilidad: aparece en la matriz.
    await page.getByRole("link", { name: "Disponibilidad" }).click();
    await expect(page.getByRole("rowheader", { name: teamName })).toBeVisible();
    await logout(page);

    // 6. El compañero se sale: la inscripción vuelve a pendiente.
    await login(page, partnerEmail);
    await page.goto(teamUrl);
    await expect(page.getByText("Aprobada")).toBeVisible();
    await page.getByRole("button", { name: "Salir del equipo" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Salir del equipo" }).click();
    await expect(page).toHaveURL("/torneos");
    await logout(page);

    await login(page, captainEmail);
    await page.goto(teamUrl);
    await expect(page.getByText("Tu inscripción está pendiente")).toBeVisible();
  });

  test("código inválido y validaciones del formulario", async ({ page }) => {
    await login(page, "eva@demo.test");
    await page.goto("/unirse/NOEXISTE00");
    await expect(page.getByText("El código no es válido")).toBeVisible();

    // Eva ya está inscripta en el demo.
    await page.goto(`/unirse/${DEMO_CODE}`);
    await expect(page.getByText("Ya estás inscripto en este torneo")).toBeVisible();

    const email = uniqueEmail("solo");
    await logout(page);
    await signUpAndConfirm(page, { name: "Sol Sola", email });
    await page.goto(`/unirse/${DEMO_CODE}`);
    await page.getByLabel("Email de tu pareja").fill(email);
    await page.getByRole("button", { name: "Inscribirme" }).click();
    await expectToast(page, "No incluyas tu propio email: ya quedás como capitán.");
  });
});
