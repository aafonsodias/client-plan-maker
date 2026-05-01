import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy · Forge" },
      { name: "description", content: "How Forge handles your data." },
    ],
  }),
});

function PrivacyPage() {
  const { t } = useTranslation("common");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-light tracking-[0.2em] uppercase text-sm">
            <Logo className="h-7 w-7" />
            <span>{t("brand.name")}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-light tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>
        <div className="mt-8 space-y-5 text-[15px] leading-[1.7] text-foreground/85">
          <p>
            Forge takes privacy seriously. This page summarizes how we handle data.
            <em> This is a placeholder while we finalize the policy with counsel — replace
            before public launch.</em>
          </p>
          <h2 className="text-xl font-medium">Data we store</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Account info: email, name, business details you provide.</li>
            <li>Client records you upload: assessments, plans, session logs.</li>
            <li>Usage telemetry strictly necessary for operating the Service.</li>
          </ul>
          <h2 className="text-xl font-medium">Where it lives</h2>
          <p>Hosted in EU regions via Supabase. We do not sell or share client data.</p>
          <h2 className="text-xl font-medium">Your rights</h2>
          <p>Export or delete any record at any time from the dashboard. Email
          <a className="text-accent hover:underline" href="mailto:hello@forge.app"> hello@forge.app</a>
          {" "}for GDPR requests.</p>
          <h2 className="text-xl font-medium">Cookies</h2>
          <p>We use only essential cookies for authentication. No third-party trackers.</p>
        </div>
        <p className="mt-12 text-sm">
          <Link to="/" className="text-accent hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  );
}
