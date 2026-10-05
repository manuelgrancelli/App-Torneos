import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Permite usar env(safe-area-inset-*) en iOS (barra inferior).
  viewportFit: "cover",
};

/**
 * Async + connection(): todas las páginas se renderizan por request, que es lo
 * que necesita la CSP con nonce (D-041). Una página estática saldría sin el
 * nonce y sus scripts quedarían bloqueados.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const cookieStore = await cookies();
  const themeCookie = (cookieStore.get("theme")?.value as "light" | "dark" | "system") || "system";
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const isDarkInitial = themeCookie === "dark";

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${isDarkInitial ? "dark " : ""}h-full antialiased`}
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=document.cookie.match(/(?:^|; )theme=([^;]*)/);var v=t?decodeURIComponent(t[1]):(localStorage.getItem('theme')||'system');var d=v==='dark'||(v==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider defaultTheme={themeCookie}>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
