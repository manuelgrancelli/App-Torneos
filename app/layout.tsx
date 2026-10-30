import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TopLoadingBar } from "@/components/shared/top-loading-bar";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lmtorneos.com"),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

/**
 * Async + connection(): todas las páginas se renderizan por request, que es lo
 * que necesita la CSP con nonce (D-041).
 * El tema oscuro/claro se resuelve directamente en el servidor desde la cookie 'theme'
 * y se aplica a la etiqueta <html>, eliminando scripts bloqueantes y previniendo
 * advertencias de React 19.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const cookieStore = await cookies();
  const themeCookie = (cookieStore.get("theme")?.value as "light" | "dark" | "system") || "system";
  const isDarkInitial = themeCookie === "dark";

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${isDarkInitial ? "dark " : ""}h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider defaultTheme={themeCookie}>
          {children}
          <TopLoadingBar />
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
