import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { scheduledGroupScenario } from "./fixtures";
import { login, logout } from "./helpers";

/**
 * Pasada de accesibilidad (axe, WCAG 2.1 A/AA) y de CSP: cada pantalla se
 * revisa en mobile (360px) y no puede haber violaciones de la política.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Junta los errores de CSP que el navegador reporta en consola. */
function collectCspErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

/** Analiza la pantalla actual tal como está (por ejemplo, con un diálogo abierto). */
async function expectNoViolations(page: Page, label: string) {
  // Las animaciones de entrada (fade/zoom) alteran el contraste medido: se esperan las finitas.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`.trim())
        .join(" | ")}`,
  );
  expect(summary, `Violaciones de accesibilidad en ${label}`).toEqual([]);
}

async function expectAccessible(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expectNoViolations(page, path);
}

test.describe("accesibilidad y CSP (F9)", () => {
  test("pantallas públicas", async ({ page }) => {
    const scenario = await scheduledGroupScenario();
    const csp = collectCspErrors(page);
    for (const path of [
      "/",
      "/login",
      "/registro",
      "/recuperar-clave",
      "/t/torneo-demo-padel",
      `/t/${scenario.slug}`,
      `/t/${scenario.slug}?vista=fixture`,
      "/t/no-existe",
    ]) {
      await expectAccessible(page, path);
    }
    expect(csp).toEqual([]);
  });

  test("pantallas del participante y del organizador", async ({ page }) => {
    const scenario = await scheduledGroupScenario();
    const ana = scenario.teams.find((t) => t.captain === "ana@demo.test");
    const csp = collectCspErrors(page);

    await login(page, "ana@demo.test");
    for (const path of ["/torneos", "/proximos", "/historial", "/perfil", `/inscripciones/${ana?.id}`]) {
      await expectAccessible(page, path);
    }
    await logout(page);

    await login(page, "organizador@demo.test");
    const base = `/torneos/${scenario.tournamentId}`;
    for (const path of [
      "/torneos/nuevo",
      base,
      `${base}/configuracion`,
      `${base}/canchas-franjas`,
      `${base}/inscripciones`,
      `${base}/disponibilidad`,
      `${base}/grupos`,
      `${base}/partidos`,
      `${base}/cuadro`,
    ]) {
      await expectAccessible(page, path);
    }

    // Diálogos: carga de resultado y programación automática.
    await page.goto(`${base}/partidos`);
    await page.getByRole("button", { name: /^Acciones:/ }).first().click();
    await page.getByRole("menuitem", { name: "Cargar resultado" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoViolations(page, "diálogo de resultado");
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Programar automáticamente" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoViolations(page, "diálogo de programación");

    expect(csp).toEqual([]);
  });
});
