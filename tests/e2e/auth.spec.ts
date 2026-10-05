import { expect, test } from "@playwright/test";
import { extractConfirmLink, login, logout, signUpAndConfirm, uniqueEmail, waitForMail } from "./helpers";

test.describe("autenticación", () => {
  test("ruta privada sin sesión pide login con next", async ({ page }) => {
    await page.goto("/torneos");
    await expect(page).toHaveURL("/login?next=%2Ftorneos");
  });

  test("cambia el tema y lo conserva al recargar", async ({ page }) => {
    await login(page, "organizador@demo.test");

    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Activar tema claro" })).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/torneos");
    await page.getByRole("button", { name: "Activar tema claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("registro, confirmación, logout, login y redirects", async ({ page }) => {
    const email = uniqueEmail("auth");
    await page.goto("/registro");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Ingresá tu nombre y apellido.")).toBeVisible();

    // Antes de confirmar no se puede entrar.
    await page.getByLabel("Nombre y apellido").fill("Juana Pérez");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
    await page.getByLabel("Repetí la contraseña").fill("clave-segura-1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Revisá tu email")).toBeVisible();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("clave-segura-1");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Tenés que confirmar tu email")).toBeVisible();

    await page.goto(extractConfirmLink(await waitForMail(email, "Confirmá tu cuenta")));
    await expect(page).toHaveURL("/torneos");
    await expect(page.getByRole("heading", { name: "Mis torneos" })).toBeVisible();

    // Con sesión, /login vuelve a la app.
    await page.goto("/login");
    await expect(page).toHaveURL("/torneos");

    await logout(page);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("incorrecta-123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();

    // Un next externo se ignora (anti open redirect).
    await page.goto("/login?next=https%3A%2F%2Fevil.example.com");
    await login(page, email, "clave-segura-1");
  });

  test("recuperar contraseña", async ({ page }) => {
    const email = uniqueEmail("recover");
    await signUpAndConfirm(page, { name: "Rita Recupera", email, password: "clave-vieja-1" });
    await logout(page);

    await page.goto("/recuperar-clave");
    await page.getByLabel("Email de tu cuenta").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText("Revisá tu email")).toBeVisible();

    await page.goto(extractConfirmLink(await waitForMail(email, "Restablecé tu contraseña")));
    await expect(page).toHaveURL("/actualizar-clave");
    await page.getByLabel("Nueva contraseña").fill("clave-nueva-2");
    await page.getByLabel("Repetí la contraseña").fill("clave-nueva-2");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL("/torneos");

    await logout(page);
    await login(page, email, "clave-nueva-2");
  });

  test("404 propio", async ({ page }) => {
    const response = await page.goto("/no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("No encontramos esta página")).toBeVisible();
  });
});
