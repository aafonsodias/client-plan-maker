import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import i18n, { applyPersistedLocale } from "@/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const { t } = useTranslation("common");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("errors.page_not_found_title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("errors.page_not_found_desc")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("errors.go_home")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Forge — Workout plans for personal trainers" },
      { name: "description", content: "Assess clients, generate AI workout plan drafts, and export branded PDFs in minutes." },
      { property: "og:title", content: "Forge — Workout plans for personal trainers" },
      { property: "og:description", content: "Assess clients, generate AI workout plan drafts, and export branded PDFs in minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Defense-in-depth: CSP via meta tag.
      // Allows Supabase REST/Realtime, OpenAI/Anthropic/Lovable AI gateway, Google OAuth,
      // and inline styles needed by Tailwind. frame-ancestors must be set as HTTP header
      // (not effective via meta) — handled separately at the edge.
      {
        httpEquiv: "Content-Security-Policy",
        content: [
          "default-src 'self'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "script-src 'self' 'unsafe-inline'",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.lovable.app https://*.lovable.app https://api.openai.com https://api.anthropic.com https://api.frankfurter.app https://api.coingecko.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
      { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
      { name: "twitter:title", content: "Forge — Workout plans for personal trainers" },
      { name: "twitter:description", content: "Assess clients, generate AI workout plan drafts, and export branded PDFs in minutes." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a6dfe31f-b880-4ca1-aa7b-c6f200feea05/id-preview-7ce323db--52660b57-3b15-46ae-b3c1-32e2157652c6.lovable.app-1777570010210.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a6dfe31f-b880-4ca1-aa7b-c6f200feea05/id-preview-7ce323db--52660b57-3b15-46ae-b3c1-32e2157652c6.lovable.app-1777570010210.png" },
      { name: "theme-color", content: "#0d1117" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Forge" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // i18n initializes in the SSR fallback locale ("en") so SSR and the first
  // client paint match. After hydration, swap to the user's persisted locale.
  useEffect(() => {
    applyPersistedLocale();
  }, []);
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <CurrencyProvider>
          <Outlet />
          <Toaster />
        </CurrencyProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}
