import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms · Protocol" },
      { name: "description", content: "Terms of service for Protocol." },
    ],
  }),
});

function TermsPage() {
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
      <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
        <h1 className="text-3xl font-light tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>
        <div className="mt-8 space-y-5 text-[15px] leading-[1.7] text-foreground/85">
          <p>
            These terms govern your use of Protocol ("the Service"). By creating an account
            you agree to use the Service in compliance with applicable laws and the
            obligations described below. <em>This page is a placeholder while we finalize
            the legal copy with counsel — replace before public launch.</em>
          </p>
          <h2 className="text-xl font-medium">1. Account & responsibility</h2>
          <p>You are responsible for the safety, suitability and accuracy of any training plan
          you generate, edit, or deliver to a client through Protocol. Protocol provides tooling,
          not medical or rehabilitation advice.</p>
          <h2 className="text-xl font-medium">2. Client data</h2>
          <p>Client information you upload is processed under our privacy policy. You retain
          ownership; we process it on your behalf to deliver the Service.</p>
          <h2 className="text-xl font-medium">3. Acceptable use</h2>
          <p>No reverse-engineering, bulk scraping, or use of the Service to harm, harass or
          discriminate against any person.</p>
          <h2 className="text-xl font-medium">4. Termination</h2>
          <p>You can cancel anytime. We may suspend accounts that violate these terms.</p>
          <h2 className="text-xl font-medium">5. Liability</h2>
          <p>The Service is provided "as is". To the maximum extent permitted by law, Protocol
          is not liable for indirect or consequential damages arising from its use.</p>
        </div>
        <p className="mt-12 text-sm">
          <Link to="/" className="text-accent hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  );
}
