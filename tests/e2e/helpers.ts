import { type Page, expect } from "@playwright/test";

/** Contraseña de los usuarios del seed local (supabase/seed.sql). */
export const DEMO_PASSWORD = "demo1234";
export const MAILPIT_URL = "http://127.0.0.1:54324";

/** Sufijo único por corrida para no chocar con datos de corridas anteriores. */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${unique(prefix)}@example.com`;
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD, expectedPath = "/torneos") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => url.pathname === expectedPath);
}

export async function logout(page: Page) {
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.waitForURL("**/login");
}

type MailpitMessage = { ID: string; Subject: string; To: { Address: string }[] };

/** Espera un mail en Mailpit para `to` cuyo asunto contenga `subject` y devuelve su HTML. */
export async function waitForMail(to: string, subject: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`);
    const data = (await res.json()) as { messages?: MailpitMessage[] };
    const message = data.messages?.find(
      (m) => m.To.some((t) => t.Address === to) && m.Subject.includes(subject),
    );
    if (message) {
      const full = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as { HTML: string };
      return full.HTML;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No llegó el mail "${subject}" a ${to}`);
}

/** Link a /auth/confirm de un mail de Supabase Auth (templates del proyecto). */
export function extractConfirmLink(html: string): string {
  const match = html.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/);
  if (!match?.[1]) throw new Error("El mail no tiene link a /auth/confirm");
  return match[1].replaceAll("&amp;", "&");
}

/** Registra una cuenta nueva y la confirma con el link del mail. Termina con sesión iniciada. */
export async function signUpAndConfirm(page: Page, { name, email, password = DEMO_PASSWORD }: { name: string; email: string; password?: string }) {
  await page.goto("/registro");
  await page.getByLabel("Nombre y apellido").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Revisá tu email")).toBeVisible();
  const link = extractConfirmLink(await waitForMail(email, "Confirmá tu cuenta"));
  await page.goto(link);
  await page.waitForURL("**/torneos");
}

/** Espera el toast de sonner con ese texto. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
