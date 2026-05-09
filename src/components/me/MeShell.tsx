import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ClientAvatar } from "@/components/ClientAvatar";
import { BrandMark } from "@/components/BrandMark";
import { MeBottomNav } from "./MeBottomNav";

/**
 * Shared shell for /me, /me/progresso, /me/historico.
 * Owns: white-label hero, preview banner, bottom nav, page padding.
 * Each route just renders its own cards inside.
 *
 * White-label: when `trainer.primary_color` is set, we override --primary +
 * --accent on the wrapper so amber accents follow the trainer's brand. No
 * global CSS pollution.
 */
export function MeShell({
  client,
  trainer,
  previewing,
  unreadCount,
  children,
}: {
  client: { id: string; full_name: string; photo_url: string | null };
  trainer:
    | {
        business_name: string | null;
        full_name: string | null;
        logo_url: string | null;
        primary_color: string | null;
        tagline: string | null;
      }
    | null;
  previewing: boolean;
  unreadCount: number;
  children: ReactNode;
}) {
  const { t } = useTranslation("me");
  const accent = trainer?.primary_color || "";
  const accentStyle = accent
    ? ({ ["--accent" as any]: accent, ["--ring" as any]: accent } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-background pb-24" style={accentStyle}>
      <div className="mx-auto max-w-2xl space-y-5 px-5 pt-8 sm:px-6 sm:pt-10">
        {previewing && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              {t("preview.banner", { name: client.full_name })}
            </span>
            <Link
              to="/clients/$clientId"
              params={{ clientId: client.id }}
              className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest hover:bg-amber-500/30"
            >
              {t("preview.back")}
            </Link>
          </div>
        )}

        <TrainerHero client={client} trainer={trainer} />

        {children}
      </div>

      <MeBottomNav unreadCount={unreadCount} />
    </div>
  );
}

function TrainerHero({
  client,
  trainer,
}: {
  client: { full_name: string; photo_url: string | null };
  trainer:
    | {
        business_name: string | null;
        full_name: string | null;
        logo_url: string | null;
        tagline: string | null;
      }
    | null;
}) {
  const { t } = useTranslation("me");
  const trainerName = trainer?.business_name || trainer?.full_name || "";
  return (
    <header className="flex items-center gap-4">
      {trainer?.logo_url ? (
        // Falls back to BrandMark if the image 404s (resolves the broken
        // PROTO box from the screenshot).
        <LogoOrFallback src={trainer.logo_url} alt={trainerName} />
      ) : (
        <ClientAvatar name={client.full_name} photoUrl={client.photo_url} size={56} />
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("header.hello")}
        </p>
        <h1 className="truncate text-2xl font-light tracking-tight">{client.full_name}</h1>
        {trainerName ? (
          <p className="truncate text-xs text-muted-foreground">
            {t("header.with")} {trainerName}
          </p>
        ) : null}
        {trainer?.tagline ? (
          <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground/80">
            {trainer.tagline}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function LogoOrFallback({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-card">
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Hide the broken image, render a fallback BrandMark via DOM swap.
          const img = e.currentTarget;
          img.style.display = "none";
          if (img.parentElement && !img.parentElement.querySelector("[data-mark-fallback]")) {
            const span = document.createElement("span");
            span.dataset.markFallback = "true";
            span.className =
              "absolute inset-0 grid place-items-center bg-gradient-to-br from-amber-500/20 to-card";
            span.innerHTML =
              '<span class="text-[10px] font-semibold uppercase tracking-widest text-amber-700">' +
              (alt?.slice(0, 2).toUpperCase() || "PT") +
              "</span>";
            img.parentElement.appendChild(span);
          }
        }}
      />
    </div>
  );
}

// Re-export so we don't need a separate import in routes.
export { BrandMark };